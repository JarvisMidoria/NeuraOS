import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SalesOrdersManager } from "@/components/admin/sales/sales-orders-manager";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function SalesOrdersPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const companyId = session.user.companyId;

  const [clients, products, warehouses] = await Promise.all([
    prisma.client.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unitPrice: true },
    }),
    prisma.warehouse.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);

  const canManageSales = session.user.permissions?.includes("MANAGE_SALES") ?? false;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === "fr" ? "Ventes" : "Sales"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {lang === "fr" ? "Commandes" : "Orders"}
        </h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Revoyez, approuvez et confirmez les commandes pour declencher les mouvements de stock."
            : "Review, approve, and confirm orders to trigger stock movements."}
        </p>
      </div>
      <SalesOrdersManager
        clients={clients}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.unitPrice.toString(),
        }))}
        warehouses={warehouses}
        canManageSales={canManageSales}
        lang={lang}
      />
    </div>
  );
}
