import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, ensureRoles, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);

    const body = await req.json();
    const { productId, fromWarehouseId, toWarehouseId, quantity, reference, movementDate } = body;

    if (!productId || !fromWarehouseId || !toWarehouseId || quantity === undefined) {
      throw new ApiError(400, "Missing required fields");
    }
    if (fromWarehouseId === toWarehouseId) {
      throw new ApiError(400, "Warehouses must be different for transfer");
    }

    const qty = new Prisma.Decimal(quantity);
    if (qty.lte(0)) {
      throw new ApiError(400, "Quantity must be greater than zero");
    }

    const date = movementDate ? new Date(movementDate) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, "Invalid movementDate");
    }

    const companyId = session.user.companyId;

    const [product, fromWarehouse, toWarehouse] = await Promise.all([
      prisma.product.findFirst({ where: { id: productId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: fromWarehouseId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: toWarehouseId, companyId } }),
    ]);

    if (!product) {
      throw new ApiError(404, "Product not found");
    }
    if (!fromWarehouse || !toWarehouse) {
      throw new ApiError(404, "Warehouse not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      const outbound = await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          warehouseId: fromWarehouseId,
          movementType: StockMovementType.OUTBOUND,
          quantity: qty.negated(),
          reference: reference ?? null,
          movementDate: date,
        },
      });

      const inbound = await tx.stockMovement.create({
        data: {
          companyId,
          productId,
          warehouseId: toWarehouseId,
          movementType: StockMovementType.INBOUND,
          quantity: qty,
          reference: reference ?? null,
          movementDate: date,
        },
      });

      return { outbound, inbound };
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "stockMovement",
      entityId: result.outbound.id,
      action: "STOCK_TRANSFER",
      metadata: {
        product: { id: product.id, sku: product.sku, name: product.name },
        fromWarehouse: { id: fromWarehouse.id, name: fromWarehouse.name },
        toWarehouse: { id: toWarehouse.id, name: toWarehouse.name },
        quantity: qty.toString(),
        outboundId: result.outbound.id,
        inboundId: result.inbound.id,
      },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
