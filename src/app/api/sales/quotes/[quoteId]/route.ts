import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  ensurePermissions,
  ensureRoles,
  handleApiError,
  requireSession,
} from "@/lib/api-helpers";
import { prepareQuotePayload } from "@/lib/sales/quote-calculations";
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

const editableStatuses = new Set<DocumentStatus>([DocumentStatus.DRAFT, DocumentStatus.REJECTED]);

const statusMatrix: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.SENT, DocumentStatus.APPROVED, DocumentStatus.REJECTED],
  [DocumentStatus.SENT]: [DocumentStatus.APPROVED, DocumentStatus.REJECTED],
  [DocumentStatus.APPROVED]: [DocumentStatus.REJECTED],
  [DocumentStatus.REJECTED]: [DocumentStatus.DRAFT],
  [DocumentStatus.CONVERTED]: [],
  [DocumentStatus.CONFIRMED]: [],
  [DocumentStatus.PARTIAL]: [],
  [DocumentStatus.FULFILLED]: [],
  [DocumentStatus.CLOSED]: [],
  [DocumentStatus.CANCELLED]: [],
  [DocumentStatus.PARTIALLY_RECEIVED]: [],
  [DocumentStatus.RECEIVED]: [],
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

function ensureQuoteTransition(current: DocumentStatus, next: DocumentStatus) {
  const allowed = statusMatrix[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ApiError(400, `Cannot transition quote from ${current} to ${next}`);
  }
}

type QuoteUpdatePayload = {
  clientId?: string;
  validUntil?: string | null;
  notes?: string | null;
  lines?: Array<{
    productId: string;
    description?: string;
    warehouseId?: string | null;
    quantity: number | string;
    unitPrice: number | string;
    taxes?: Array<{ label?: string; taxCode?: string; rate: number | string }>;
  }>;
  status?: DocumentStatus;
};

interface RouteContext {
  params: Promise<{ quoteId: string }>;
}

async function getQuoteOrThrow(companyId: string, quoteId: string) {
  const quote = await prisma.salesQuote.findFirst({
    where: { id: quoteId, companyId },
    include: quoteInclude,
  });
  if (!quote) {
    throw new ApiError(404, "Quote not found");
  }
  return quote;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);
    const { quoteId } = await context.params;
    const quote = await getQuoteOrThrow(session.user.companyId, quoteId);
    return NextResponse.json({ data: serializeQuote(quote) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);
    const { quoteId } = await context.params;

    const body = (await req.json()) as QuoteUpdatePayload;
    const companyId = session.user.companyId;
    const quote = await getQuoteOrThrow(companyId, quoteId);

    if (body.lines) {
      if (!editableStatuses.has(quote.status)) {
        throw new ApiError(400, "Only draft or rejected quotes can be edited");
      }

      if (!body.lines.length) {
        throw new ApiError(400, "At least one line is required");
      }

      const targetClientId = body.clientId ?? quote.clientId;

      const client = await prisma.client.findFirst({
        where: { id: targetClientId, companyId },
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
      const validUntil = parseValidUntil(body.validUntil ?? quote.validUntil?.toISOString());

      const updated = await prisma.$transaction(async (tx) => {
        await tx.salesQuoteLine.deleteMany({ where: { salesQuoteId: quote.id } });
        await tx.salesQuoteTaxLine.deleteMany({ where: { salesQuoteId: quote.id } });
        return tx.salesQuote.update({
          where: { id: quote.id },
          data: {
            clientId: targetClientId,
            validUntil,
            notes: body.notes ?? quote.notes,
            subtotalAmount: prepared.subtotal,
            taxAmount: prepared.taxTotal,
            totalAmount: prepared.subtotal.add(prepared.taxTotal),
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
        entityId: quote.id,
        action: "QUOTE_UPDATED",
        metadata: { quoteNumber: quote.quoteNumber },
      });

      return NextResponse.json({ data: serializeQuote(updated) });
    }

    if (body.status) {
      if (quote.status === DocumentStatus.CONVERTED) {
        throw new ApiError(400, "Converted quotes cannot change status");
      }

      if (body.status === DocumentStatus.CONVERTED) {
        throw new ApiError(400, "Conversion can only happen via the convert endpoint");
      }

      ensureQuoteTransition(quote.status, body.status);
      if (body.status === DocumentStatus.APPROVED) {
        ensurePermissions(session, ["MANAGE_SALES"]);
      }

      const updated = await prisma.salesQuote.update({
        where: { id: quote.id },
        data: { status: body.status },
        include: quoteInclude,
      });

      await logAudit({
        companyId,
        userId: session.user.id,
        entity: "salesQuote",
        entityId: quote.id,
        action: "QUOTE_STATUS_UPDATED",
        metadata: { from: quote.status, to: body.status },
      });

      return NextResponse.json({ data: serializeQuote(updated) });
    }

    if (body.notes !== undefined || body.validUntil !== undefined || body.clientId) {
      const targetClientId = body.clientId ?? quote.clientId;
      const client = await prisma.client.findFirst({
        where: { id: targetClientId, companyId },
      });
      if (!client) {
        throw new ApiError(400, "Invalid client");
      }

      const updated = await prisma.salesQuote.update({
        where: { id: quote.id },
        data: {
          clientId: targetClientId,
          notes: body.notes ?? quote.notes,
          validUntil: parseValidUntil(body.validUntil ?? quote.validUntil?.toISOString()),
        },
        include: quoteInclude,
      });

      await logAudit({
        companyId,
        userId: session.user.id,
        entity: "salesQuote",
        entityId: quote.id,
        action: "QUOTE_METADATA_UPDATED",
      });

      return NextResponse.json({ data: serializeQuote(updated) });
    }

    throw new ApiError(400, "No updates provided");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);
    const { quoteId } = await context.params;

    const companyId = session.user.companyId;
    const quote = await getQuoteOrThrow(companyId, quoteId);

    if (!editableStatuses.has(quote.status)) {
      throw new ApiError(400, "Only draft or rejected quotes can be deleted");
    }

    await prisma.$transaction([
      prisma.salesQuoteLine.deleteMany({ where: { salesQuoteId: quote.id } }),
      prisma.salesQuoteTaxLine.deleteMany({ where: { salesQuoteId: quote.id } }),
      prisma.salesQuote.delete({ where: { id: quote.id } }),
    ]);

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "salesQuote",
      entityId: quote.id,
      action: "QUOTE_DELETED",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
