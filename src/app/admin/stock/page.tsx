import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StockConsole } from "@/components/admin/stock/stock-console";
import { getAdminLang } from "@/lib/admin-preferences";
import { getCurrentStock, getLowStockProducts, getStockByWarehouse } from "@/lib/stock-service";

export default async function StockPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const companyId = session.user.companyId;

  const [warehouses, products, lowStock] = await Promise.all([
    prisma.warehouse.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { companyId, isActive: true },
      select: { id: true, sku: true, name: true, unitOfMeasure: true, lowStockThreshold: true },
      orderBy: { name: "asc" },
    }),
    getLowStockProducts(companyId),
  ]);

  const stockSnapshots = await Promise.all(
    products.map(async (product) => {
      const [total, warehouseBreakdown] = await Promise.all([
        getCurrentStock(companyId, product.id),
        getStockByWarehouse(companyId, product.id),
      ]);

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitOfMeasure: product.unitOfMeasure,
        lowStockThreshold: product.lowStockThreshold?.toString() ?? null,
        totalQuantity: total.toString(),
        warehouses: warehouseBreakdown.map((entry) => ({
          warehouseId: entry.warehouseId,
          warehouseName: entry.warehouseName,
          quantity: entry.quantity.toString(),
        })),
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === "fr" ? "Stock" : "Inventory"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {lang === "fr" ? "Gestion des stocks" : "Stock Control"}
        </h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Enregistrez les mouvements, suivez les soldes par entrepot et les alertes de stock bas."
            : "Record stock movements, view balances by warehouse, and monitor low-stock alerts."}
        </p>
      </div>
      <StockConsole warehouses={warehouses} products={stockSnapshots} lowStock={lowStock} lang={lang} />
    </div>
  );
}
