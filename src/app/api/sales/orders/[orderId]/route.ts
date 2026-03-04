import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DocumentStatus, Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  ensurePermissions,
  ensureRoles,
  handleApiError,
  requireSession,
} from "@/lib/api-helpers";
import { getCurrentStock } from "@/lib/stock-service";
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

const transitionMatrix: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.APPROVED, DocumentStatus.REJECTED],
  [DocumentStatus.APPROVED]: [DocumentStatus.CONFIRMED, DocumentStatus.REJECTED],
  [DocumentStatus.REJECTED]: [],
  [DocumentStatus.CONFIRMED]: [],
  [DocumentStatus.CONVERTED]: [],
  [DocumentStatus.SENT]: [],
  [DocumentStatus.PARTIAL]: [],
  [DocumentStatus.FULFILLED]: [],
  [DocumentStatus.CLOSED]: [],
  [DocumentStatus.CANCELLED]: [],
};

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
    approvedAt: order.approvedAt,
    confirmedAt: order.confirmedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function ensureTransition(current: DocumentStatus, next: DocumentStatus) {
  const allowed = transitionMatrix[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ApiError(400, `Cannot transition order from ${current} to ${next}`);
  }
}

interface RouteContext {
  params: { orderId: string };
}

type OrderStatusPayload = {
  status: DocumentStatus;
};

async function getOrderOrThrow(companyId: string, orderId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: orderInclude,
  });
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  return order;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);
    const order = await getOrderOrThrow(session.user.companyId, params.orderId);
    return NextResponse.json({ data: serializeOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);

    const body = (await req.json()) as OrderStatusPayload;
    if (!body.status) {
      throw new ApiError(400, "status is required");
    }

    const companyId = session.user.companyId;
    const order = await getOrderOrThrow(companyId, params.orderId);

    ensureTransition(order.status, body.status);

    if (body.status === DocumentStatus.APPROVED || body.status === DocumentStatus.CONFIRMED) {
      ensurePermissions(session, ["MANAGE_SALES"]);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.status === DocumentStatus.APPROVED) {
        return tx.salesOrder.update({
          where: { id: order.id },
          data: {
            status: DocumentStatus.APPROVED,
            approvedById: session.user.id,
            approvedAt: new Date(),
          },
          include: orderInclude,
        });
      }

      if (body.status === DocumentStatus.CONFIRMED) {
        for (const line of order.lines) {
          const available = await getCurrentStock(companyId, line.productId, line.warehouseId, tx);
          if (available.lt(line.quantity)) {
            throw new ApiError(409, "Insufficient stock to confirm order", {
              lineId: line.id,
              productId: line.productId,
              warehouseId: line.warehouseId,
              available: available.toString(),
              required: line.quantity.toString(),
            });
          }
        }

        await tx.stockMovement.createMany({
          data: order.lines.map((line) => ({
            companyId,
            productId: line.productId,
            warehouseId: line.warehouseId,
            movementType: StockMovementType.OUTBOUND,
            quantity: line.quantity.negated(),
            reference: `SO-${order.orderNumber}`,
            movementDate: new Date(),
          })),
        });

        return tx.salesOrder.update({
          where: { id: order.id },
          data: {
            status: DocumentStatus.CONFIRMED,
            confirmedById: session.user.id,
            confirmedAt: new Date(),
          },
          include: orderInclude,
        });
      }

      return tx.salesOrder.update({
        where: { id: order.id },
        data: { status: body.status },
        include: orderInclude,
      });
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "salesOrder",
      entityId: order.id,
      action: `SALES_ORDER_${body.status}`,
      metadata: { from: order.status, to: body.status },
    });

    if (body.status === DocumentStatus.CONFIRMED) {
      await logAudit({
        companyId,
        userId: session.user.id,
        entity: "stockMovement",
        entityId: order.id,
        action: "STOCK_OUT",
        metadata: {
          reference: `SO-${order.orderNumber}`,
          lineCount: order.lines.length,
        },
      });
    }

    return NextResponse.json({ data: serializeOrder(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}
