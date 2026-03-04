import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { preparePurchasePayload } from "@/lib/purchases/calculations";
import { logAudit } from "@/lib/audit";

const orderInclude = {
  supplier: true,
  lines: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      goodsReceiptLines: { select: { id: true } },
    },
  },
  taxLines: true,
  goodsReceipts: {
    select: { id: true, receiptNumber: true, status: true },
  },
} as const;

type PurchaseLineInput = {
  productId: string;
  quantity: number | string;
  unitPrice: number | string;
  taxes?: Array<{ label?: string; taxCode?: string; rate: number | string }>;
};

type PurchaseOrderUpdatePayload = {
  expectedDate?: string | null;
  notes?: string | null;
  lines?: PurchaseLineInput[];
  status?: DocumentStatus;
};

const transitionMatrix: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.SENT, DocumentStatus.CANCELLED],
  [DocumentStatus.SENT]: [DocumentStatus.CONFIRMED, DocumentStatus.CANCELLED],
  [DocumentStatus.CONFIRMED]: [],
  [DocumentStatus.PARTIALLY_RECEIVED]: [],
  [DocumentStatus.RECEIVED]: [],
  [DocumentStatus.CANCELLED]: [],
  [DocumentStatus.APPROVED]: [],
  [DocumentStatus.REJECTED]: [],
  [DocumentStatus.CONVERTED]: [],
  [DocumentStatus.PARTIAL]: [],
  [DocumentStatus.FULFILLED]: [],
  [DocumentStatus.CLOSED]: [],
};

interface RouteContext {
  params: { orderId: string };
}

function serializeDecimal(value: Prisma.Decimal | null | undefined) {
  return value ? value.toString() : "0";
}

function serializeOrder(order: Prisma.PurchaseOrderGetPayload<{ include: typeof orderInclude }>) {
  return {
    id: order.id,
    poNumber: order.poNumber,
    orderDate: order.orderDate,
    expectedDate: order.expectedDate,
    status: order.status,
    subtotalAmount: serializeDecimal(order.subtotalAmount),
    taxAmount: serializeDecimal(order.taxAmount),
    totalAmount: serializeDecimal(order.totalAmount),
    notes: order.notes,
    supplier: order.supplier,
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: line.product,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
    taxLines: order.taxLines.map((taxLine) => ({
      id: taxLine.id,
      label: taxLine.label,
      taxCode: taxLine.taxCode,
      rate: taxLine.rate.toString(),
      baseAmount: taxLine.baseAmount.toString(),
      taxAmount: taxLine.taxAmount.toString(),
    })),
    goodsReceipts: order.goodsReceipts,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "expectedDate is invalid");
  }
  return parsed;
}

async function getOrderOrThrow(companyId: string, orderId: string) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, companyId },
    include: orderInclude,
  });
  if (!order) {
    throw new ApiError(404, "Purchase order not found");
  }
  return order;
}

function ensureTransition(current: DocumentStatus, next: DocumentStatus) {
  if (current === next) {
    return;
  }
  const allowed = transitionMatrix[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ApiError(400, `Cannot transition purchase order from ${current} to ${next}`);
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const order = await getOrderOrThrow(session.user.companyId, params.orderId);
    return NextResponse.json({ data: serializeOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);
    const companyId = session.user.companyId;

    const body = (await req.json()) as PurchaseOrderUpdatePayload;
    const order = await getOrderOrThrow(companyId, params.orderId);

    const wantsLineUpdate = Array.isArray(body.lines);
    const wantsStatusChange = body.status && body.status !== order.status;

    if (!wantsLineUpdate && !wantsStatusChange && body.expectedDate === undefined && body.notes === undefined) {
      throw new ApiError(400, "No changes detected");
    }

    const expectedDate = body.expectedDate === undefined ? order.expectedDate : parseDate(body.expectedDate);

    let statusChanged = false;
    let newStatus = order.status;

    const updated = await prisma.$transaction(async (tx) => {
      if (wantsLineUpdate) {
        if (!body.lines?.length) {
          throw new ApiError(400, "At least one line is required");
        }
        if (order.status !== DocumentStatus.DRAFT) {
          throw new ApiError(400, "Lines can only be edited while the order is in DRAFT");
        }
        if (order.goodsReceipts.length) {
          throw new ApiError(400, "Cannot edit lines once goods receipts exist");
        }

        const productIds = Array.from(new Set(body.lines.map((line) => line.productId)));
        const products = await tx.product.findMany({
          where: { companyId, id: { in: productIds } },
          select: { id: true },
        });
        if (products.length !== productIds.length) {
          throw new ApiError(400, "One or more products are invalid");
        }

        const prepared = preparePurchasePayload(body.lines);

        await tx.purchaseOrderTaxLine.deleteMany({ where: { purchaseOrderId: order.id } });
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: order.id } });

        await tx.purchaseOrder.update({
          where: { id: order.id },
          data: {
            expectedDate,
            notes: body.notes ?? order.notes ?? null,
            subtotalAmount: prepared.subtotal,
            taxAmount: prepared.taxTotal,
            totalAmount: prepared.subtotal.add(prepared.taxTotal),
            lines: {
              create: prepared.lines.map((line) => ({
                productId: line.productId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
              })),
            },
            ...(prepared.taxLines.length
              ? {
                  taxLines: {
                    create: prepared.taxLines.map((taxLine) => ({
                      label: taxLine.label,
                      taxCode: taxLine.taxCode,
                      rate: taxLine.rate,
                      baseAmount: taxLine.baseAmount,
                      taxAmount: taxLine.taxAmount,
                    })),
                  },
                }
              : {}),
          },
        });
      } else if (body.notes !== undefined || body.expectedDate !== undefined) {
        await tx.purchaseOrder.update({
          where: { id: order.id },
          data: {
            expectedDate,
            notes: body.notes ?? null,
          },
        });
      }

      if (wantsStatusChange && body.status) {
        ensureTransition(order.status, body.status);

        if (body.status === DocumentStatus.CANCELLED && order.goodsReceipts.length) {
          throw new ApiError(400, "Cannot cancel an order with goods receipts");
        }

        const updatedOrder = await tx.purchaseOrder.update({
          where: { id: order.id },
          data: { status: body.status },
          include: orderInclude,
        });
        statusChanged = true;
        newStatus = body.status;
        return updatedOrder;
      }

      return tx.purchaseOrder.findFirst({ where: { id: order.id }, include: orderInclude });
    });

    if (!updated) {
      throw new ApiError(500, "Failed to update purchase order");
    }

    if (statusChanged) {
      await logAudit({
        companyId,
        userId: session.user.id,
        entity: "purchaseOrder",
        entityId: updated.id,
        action: "PURCHASE_ORDER_STATUS_CHANGE",
        metadata: { from: order.status, to: newStatus },
      });
    } else {
      await logAudit({
        companyId,
        userId: session.user.id,
        entity: "purchaseOrder",
        entityId: updated.id,
        action: "PURCHASE_ORDER_UPDATE",
      });
    }

    return NextResponse.json({ data: serializeOrder(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);
    const companyId = session.user.companyId;

    const order = await getOrderOrThrow(companyId, params.orderId);
    if (order.status !== DocumentStatus.DRAFT) {
      throw new ApiError(400, "Only draft orders can be deleted");
    }
    if (order.goodsReceipts.length) {
      throw new ApiError(400, "Cannot delete orders with goods receipts");
    }

    await prisma.$transaction([
      prisma.purchaseOrderTaxLine.deleteMany({ where: { purchaseOrderId: order.id } }),
      prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: order.id } }),
      prisma.purchaseOrder.delete({ where: { id: order.id } }),
    ]);

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "purchaseOrder",
      entityId: order.id,
      action: "PURCHASE_ORDER_DELETE",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
