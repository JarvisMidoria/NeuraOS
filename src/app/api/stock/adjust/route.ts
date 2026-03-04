import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, ensureRoles, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

async function validateInputs(companyId: string, productId: string, warehouseId: string) {
  const [product, warehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, companyId } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
  ]);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  if (!warehouse) {
    throw new ApiError(404, "Warehouse not found");
  }

  return { product, warehouse };
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);

    const body = await req.json();
    const { productId, warehouseId, quantity, reference, movementDate } = body;

    if (!productId || !warehouseId || quantity === undefined) {
      throw new ApiError(400, "Missing required fields");
    }

    const qty = new Prisma.Decimal(quantity);
    if (qty.isZero()) {
      throw new ApiError(400, "Quantity cannot be zero");
    }

    const date = movementDate ? new Date(movementDate) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, "Invalid movementDate");
    }

    const { product, warehouse } = await validateInputs(
      session.user.companyId,
      productId,
      warehouseId,
    );

    const movement = await prisma.stockMovement.create({
      data: {
        companyId: session.user.companyId,
        productId,
        warehouseId,
        movementType: StockMovementType.ADJUSTMENT,
        quantity: qty,
        reference: reference ?? null,
        movementDate: date,
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "stockMovement",
      entityId: movement.id,
      action: "STOCK_ADJUST",
      metadata: {
        product: { id: product.id, sku: product.sku, name: product.name },
        warehouse: { id: warehouse.id, name: warehouse.name },
        quantity: movement.quantity.toString(),
      },
    });

    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
