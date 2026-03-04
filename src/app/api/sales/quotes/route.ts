import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  ensureRoles,
  handleApiError,
  requireSession,
} from "@/lib/api-helpers";
import { prepareQuotePayload } from "@/lib/sales/quote-calculations";
import { getNextQuoteNumber } from "@/lib/sales/sequencing";
import { logAudit } from "@/lib/audit";

const quoteInclude = {
  client: true,
  lines: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true } },
    },
  },
  taxLines: true,
  convertedOrder: {
    select: { id: true, orderNumber: true, status: true },
  },
} as const;

type QuoteLineInput = {
  productId: string;
  description?: string;
  quantity: number | string;
  unitPrice: number | string;
  warehouseId?: string | null;
  taxes?: Array<{ label?: string; taxCode?: string; rate: number | string }>;
};

type QuotePayload = {
  clientId: string;
  validUntil?: string | null;
  notes?: string | null;
  lines: QuoteLineInput[];
};

function serializeDecimal(value: Prisma.Decimal | null | undefined) {
  return value ? value.toString() : "0";
}

function serializeQuote(quote: Prisma.SalesQuoteGetPayload<{ include: typeof quoteInclude }>) {
  return {
    id: quote.id,
    companyId: quote.companyId,
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.quoteDate,
    validUntil: quote.validUntil,
    status: quote.status,
    subtotalAmount: serializeDecimal(quote.subtotalAmount),
    taxAmount: serializeDecimal(quote.taxAmount),
    totalAmount: serializeDecimal(quote.totalAmount),
    notes: quote.notes,
    client: quote.client,
    convertedOrder: quote.convertedOrder,
    lines: quote.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: line.product,
      warehouse: line.warehouse,
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
    taxLines: quote.taxLines.map((taxLine) => ({
      id: taxLine.id,
      label: taxLine.label,
      taxCode: taxLine.taxCode,
      rate: taxLine.rate.toString(),
      baseAmount: taxLine.baseAmount.toString(),
      taxAmount: taxLine.taxAmount.toString(),
    })),
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

function parseValidUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "validUntil is not a valid date");
  }
  return date;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "10");
    const status = searchParams.get("status") as DocumentStatus | null;
    const clientId = searchParams.get("clientId");

    const where = {
      companyId: session.user.companyId,
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
    };

    const [quotes, total] = await Promise.all([
      prisma.salesQuote.findMany({
        where,
        include: quoteInclude,
        orderBy: { quoteDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesQuote.count({ where }),
    ]);

    return NextResponse.json({
      data: quotes.map(serializeQuote),
      page,
      pageSize,
      total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);

    const body = (await req.json()) as QuotePayload;
    if (!body.clientId) {
      throw new ApiError(400, "clientId is required");
    }

    if (!Array.isArray(body.lines) || !body.lines.length) {
      throw new ApiError(400, "At least one line is required");
    }

    const companyId = session.user.companyId;

    const client = await prisma.client.findFirst({
      where: { id: body.clientId, companyId },
    });
    if (!client) {
      throw new ApiError(400, "Invalid client");
    }

    const productIds = Array.from(new Set(body.lines.map((line) => line.productId)));
    const products = await prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new ApiError(400, "One or more products are invalid");
    }

    const warehouseIds = Array.from(
      new Set(
        body.lines
          .map((line) => line.warehouseId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (warehouseIds.length) {
      const warehouses = await prisma.warehouse.findMany({
        where: { companyId, id: { in: warehouseIds } },
        select: { id: true },
      });
      if (warehouses.length !== warehouseIds.length) {
        throw new ApiError(400, "One or more warehouses are invalid");
      }
    }

    const prepared = prepareQuotePayload(body.lines);
    const validUntil = parseValidUntil(body.validUntil);

    const created = await prisma.$transaction(async (tx) => {
      const quoteNumber = await getNextQuoteNumber(tx, companyId);
      return tx.salesQuote.create({
        data: {
          companyId,
          clientId: body.clientId,
          quoteNumber,
          quoteDate: new Date(),
          validUntil,
          status: DocumentStatus.DRAFT,
          subtotalAmount: prepared.subtotal,
          taxAmount: prepared.taxTotal,
          totalAmount: prepared.subtotal.add(prepared.taxTotal),
          notes: body.notes ?? null,
          createdById: session.user.id,
          lines: {
            create: prepared.lines.map((line) => ({
              productId: line.productId,
              description: line.description,
              warehouseId: line.warehouseId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
          taxLines: {
            create: prepared.taxLines.map((taxLine) => ({
              label: taxLine.label,
              taxCode: taxLine.taxCode,
              rate: taxLine.rate,
              baseAmount: taxLine.baseAmount,
              taxAmount: taxLine.taxAmount,
            })),
          },
        },
        include: quoteInclude,
      });
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "salesQuote",
      entityId: created.id,
      action: "QUOTE_CREATED",
      metadata: { quoteNumber: created.quoteNumber },
    });

    return NextResponse.json({ data: serializeQuote(created) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
