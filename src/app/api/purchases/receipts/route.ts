import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DocumentStatus, Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { getNextReceiptNumber } from "@/lib/purchases/sequencing";
import { buildReceiptPlan } from "@/lib/purchases/receipt-plan";
import { ensureOverReceiveOverridePermission } from "@/lib/purchases/permissions";
import { logAudit } from "@/lib/audit";

const receiptInclude = {
  purchaseOrder: {
    select: { id: true, poNumber: true, status: true },
  },
  warehouse: true,
  lines: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true } },
      purchaseOrderLine: { select: { id: true } },
    },
  },
} as const;

type ReceiptLineInput = {
  purchaseOrderLineId: string;
  productId: string;
  warehouseId: string;
  quantity: number | string;
  unitPrice?: number | string;
};

type ReceiptPayload = {
  purchaseOrderId: string;
  warehouseId: string;
  notes?: string | null;
  lines: ReceiptLineInput[];
  allowOverReceive?: boolean;
  overrideReason?: string | null;
};

function serializeReceipt(receipt: Prisma.GoodsReceiptGetPayload<{ include: typeof receiptInclude }>) {
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    purchaseOrder: receipt.purchaseOrder,
    warehouse: receipt.warehouse,
    status: receipt.status,
    notes: receipt.notes,
    receivedDate: receipt.receivedDate,
    lines: receipt.lines.map((line) => ({
      id: line.id,
      purchaseOrderLineId: line.purchaseOrderLineId,
      productId: line.productId,
      product: line.product,
      warehouse: line.warehouse,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "10");
    const purchaseOrderId = searchParams.get("purchaseOrderId");

    const where = {
      companyId: session.user.companyId,
      ...(purchaseOrderId ? { purchaseOrderId } : {}),
    };

    const [receipts, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        include: receiptInclude,
        orderBy: { receivedDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return NextResponse.json({
      data: receipts.map(serializeReceipt),
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
    ensurePermissions(session, ["MANAGE_PURCHASING"]);
    const companyId = session.user.companyId;

    const body = (await req.json()) as ReceiptPayload;
    if (!body.purchaseOrderId) {
      throw new ApiError(400, "purchaseOrderId is required");
    }
    if (!body.warehouseId) {
      throw new ApiError(400, "warehouseId is required");
    }
    if (!Array.isArray(body.lines) || !body.lines.length) {
      throw new ApiError(400, "At least one line is required");
    }

    body.lines.forEach((line, index) => {
      if (!line.warehouseId) {
        throw new ApiError(400, `lines[${index}].warehouseId is required`);
      }
      if (line.warehouseId !== body.warehouseId) {
        throw new ApiError(400, "All receipt lines must use the same warehouse");
      }
    });

    const [order, warehouse] = await Promise.all([
      prisma.purchaseOrder.findFirst({
        where: { id: body.purchaseOrderId, companyId },
        include: {
          lines: {
            include: {
              goodsReceiptLines: {
                select: { quantity: true },
              },
            },
          },
          supplier: true,
        },
      }),
      prisma.warehouse.findFirst({ where: { id: body.warehouseId, companyId } }),
    ]);

    if (!order) {
      throw new ApiError(404, "Purchase order not found");
    }
    if (!warehouse) {
      throw new ApiError(400, "Invalid warehouse");
    }

    if ([DocumentStatus.CANCELLED, DocumentStatus.RECEIVED].includes(order.status)) {
      throw new ApiError(400, "Cannot receive goods for this purchase order");
    }

    const allowedStatuses = [DocumentStatus.SENT, DocumentStatus.CONFIRMED, DocumentStatus.PARTIALLY_RECEIVED];
    if (!allowedStatuses.includes(order.status)) {
      throw new ApiError(400, "Purchase order must be SENT or CONFIRMED before receiving goods");
    }

    const orderLines = order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      unitPrice: line.unitPrice,
      orderedQuantity: line.quantity,
      receivedQuantity: line.goodsReceiptLines.reduce(
        (acc, entry) => acc.add(entry.quantity),
        new Prisma.Decimal(0),
      ),
    }));

    const plan = buildReceiptPlan(orderLines, body.lines, {
      allowOverReceive: Boolean(body.allowOverReceive),
    });

    if (plan.overrideUsed) {
      ensureOverReceiveOverridePermission(session, true);
      if (!body.overrideReason) {
        throw new ApiError(400, "overrideReason is required when overriding over-receipts");
      }
    }

    const receipt = await prisma.$transaction(async (tx) => {
      const receiptNumber = await getNextReceiptNumber(tx, companyId);
      const createdReceipt = await tx.goodsReceipt.create({
        data: {
          companyId,
          purchaseOrderId: order.id,
          warehouseId: body.warehouseId,
          receiptNumber,
          notes: body.notes ?? null,
          status: plan.resultingStatus,
          lines: {
            create: plan.lines.map((line) => ({
              purchaseOrderLineId: line.purchaseOrderLineId,
              productId: line.productId,
              warehouseId: line.warehouseId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: receiptInclude,
      });

      await tx.stockMovement.createMany({
        data: plan.stockMovements.map((movement) => ({
          companyId,
          productId: movement.productId,
          warehouseId: movement.warehouseId,
          movementType: StockMovementType.INBOUND,
          quantity: movement.quantity,
          reference: `GR-${receiptNumber}`,
          movementDate: new Date(),
        })),
      });

      if (order.status !== plan.resultingStatus) {
        await tx.purchaseOrder.update({
          where: { id: order.id },
          data: { status: plan.resultingStatus },
        });
      }

      return createdReceipt;
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "goodsReceipt",
      entityId: receipt.id,
      action: "GOODS_RECEIPT_CREATE",
      metadata: { purchaseOrderId: order.id },
    });

    if (plan.overrideUsed) {
      await logAudit({
        companyId,
        userId: session.user.id,
        entity: "goodsReceipt",
        entityId: receipt.id,
        action: "GOODS_RECEIPT_OVERRIDE",
        metadata: { reason: body.overrideReason },
      });
    }

    if (order.status !== plan.resultingStatus) {
      await logAudit({
        companyId,
        userId: session.user.id,
        entity: "purchaseOrder",
        entityId: order.id,
        action: "PURCHASE_ORDER_STATUS_CHANGE",
        metadata: { from: order.status, to: plan.resultingStatus },
      });
    }

    return NextResponse.json({ data: serializeReceipt(receipt) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
