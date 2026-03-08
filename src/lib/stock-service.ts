import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getCurrentStock(
  companyId: string,
  productId: string,
  warehouseId?: string,
  db: DbClient = prisma,
) {
  const aggregate = await db.stockMovement.aggregate({
    _sum: { quantity: true },
    where: {
      companyId,
      productId,
      ...(warehouseId ? { warehouseId } : {}),
    },
  });

  return aggregate._sum.quantity ?? new Prisma.Decimal(0);
}

export async function getStockByWarehouse(
  companyId: string,
  productId: string,
  db: DbClient = prisma,
) {
  const grouped = await db.stockMovement.groupBy({
    by: ["warehouseId"],
    _sum: { quantity: true },
    where: {
      companyId,
      productId,
    },
  });

  if (!grouped.length) {
    return [] as Array<{
      warehouseId: string;
      warehouseName: string;
      quantity: Prisma.Decimal;
    }>;
  }

  const warehouses = await db.warehouse.findMany({
    where: {
      companyId,
      id: { in: grouped.map((entry) => entry.warehouseId) },
    },
    select: { id: true, name: true },
  });
  const warehouseMap = new Map(warehouses.map((wh) => [wh.id, wh.name]));

  return grouped.map((entry) => ({
    warehouseId: entry.warehouseId,
    warehouseName: warehouseMap.get(entry.warehouseId) ?? "Unknown",
    quantity: entry._sum.quantity ?? new Prisma.Decimal(0),
  }));
}

export async function getLowStockProducts(companyId: string, db: DbClient = prisma) {
  const [products, totals] = await Promise.all([
    db.product.findMany({
      where: {
        companyId,
        isActive: true,
        lowStockThreshold: { not: null },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        unitOfMeasure: true,
        lowStockThreshold: true,
      },
    }),
    db.stockMovement.groupBy({
      by: ["productId"],
      where: { companyId },
      _sum: { quantity: true },
    }),
  ]);

  const stockMap = new Map<string, Prisma.Decimal>();
  totals.forEach((row) => {
    stockMap.set(row.productId, row._sum.quantity ?? new Prisma.Decimal(0));
  });

  return products
    .filter((product) => {
      if (!product.lowStockThreshold) {
        return false;
      }
      const total = stockMap.get(product.id) ?? new Prisma.Decimal(0);
      return total.lt(product.lowStockThreshold);
    })
    .map((product) => {
      const total = stockMap.get(product.id) ?? new Prisma.Decimal(0);
      const threshold = product.lowStockThreshold ?? new Prisma.Decimal(0);
      const suggested = threshold.sub(total);
      const suggestedQty = suggested.gt(new Prisma.Decimal(0)) ? suggested : new Prisma.Decimal(0);

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unitOfMeasure: product.unitOfMeasure,
        lowStockThreshold: threshold.toString(),
        currentStock: total.toString(),
        suggestedQuantity: suggestedQty.toString(),
      };
    });
}
