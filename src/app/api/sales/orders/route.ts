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
import { getNextOrderNumber } from "@/lib/sales/sequencing";
import { logAudit } from "@/lib/audit";

const orderInclude = {
  client: true,
  lines: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true } },
    },
  },
  taxLines: true,
} as const;

function serializeDecimal(value: Prisma.Decimal | null | undefined) {
  return value ? value.toString() : "0";
}

function serializeOrder(order: Prisma.SalesOrderGetPayload<{ include: typeof orderInclude }>) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    status: order.status,
    subtotalAmount: serializeDecimal(order.subtotalAmount),
    taxAmount: serializeDecimal(order.taxAmount),
    totalAmount: serializeDecimal(order.totalAmount),
    notes: order.notes,
    client: order.client,
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: line.product,
      warehouse: line.warehouse,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
      description: line.description,
    })),
    taxLines: order.taxLines.map((taxLine) => ({
      id: taxLine.id,
      label: taxLine.label,
      taxCode: taxLine.taxCode,
      rate: taxLine.rate.toString(),
      baseAmount: taxLine.baseAmount.toString(),
      taxAmount: taxLine.taxAmount.toString(),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    approvedAt: order.approvedAt,
    confirmedAt: order.confirmedAt,
  };
}

type OrderLineInput = {
  productId: string;
  warehouseId: string;
  description?: string;
  quantity: number | string;
  unitPrice: number | string;
  taxes?: Array<{ label?: string; taxCode?: string; rate: number | string }>;
};

type OrderPayload = {
  clientId: string;
  notes?: string | null;
  lines: OrderLineInput[];
};

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "10");
    const status = searchParams.get("status") as DocumentStatus | null;

    const where = {
      companyId: session.user.companyId,
      ...(status ? { status } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { orderDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return NextResponse.json({
      data: orders.map(serializeOrder),
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

    const body = (await req.json()) as OrderPayload;
    if (!body.clientId) {
      throw new ApiError(400, "clientId is required");
    }
    if (!Array.isArray(body.lines) || !body.lines.length) {
      throw new ApiError(400, "At least one line is required");
    }

    if (body.lines.some((line) => !line.warehouseId)) {
      throw new ApiError(400, "Each order line must include a warehouseId");
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

    const warehouseIds = Array.from(new Set(body.lines.map((line) => line.warehouseId)));
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId, id: { in: warehouseIds } },
      select: { id: true },
    });
    if (warehouses.length !== warehouseIds.length) {
      throw new ApiError(400, "One or more warehouses are invalid");
    }

    const prepared = prepareQuotePayload(body.lines);

    const created = await prisma.$transaction(async (tx) => {
      const orderNumber = await getNextOrderNumber(tx, companyId);
      return tx.salesOrder.create({
        data: {
          companyId,
          clientId: body.clientId,
          orderNumber,
          orderDate: new Date(),
          status: DocumentStatus.DRAFT,
          subtotalAmount: prepared.subtotal,
          taxAmount: prepared.taxTotal,
          totalAmount: prepared.subtotal.add(prepared.taxTotal),
          notes: body.notes ?? null,
          createdById: session.user.id,
          lines: {
            create: prepared.lines.map((line) => ({
              productId: line.productId,
              warehouseId: line.warehouseId!,
              description: line.description,
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
        include: orderInclude,
      });
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "salesOrder",
      entityId: created.id,
      action: "SALES_ORDER_CREATED",
      metadata: { orderNumber: created.orderNumber },
    });

    return NextResponse.json({ data: serializeOrder(created) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
