import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SalesQuotesManager } from "@/components/admin/sales/sales-quotes-manager";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function SalesQuotesPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const companyId = session.user.companyId;

  const [clients, products, warehouses, company] = await Promise.all([
    prisma.client.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unitPrice: true },
    }),
    prisma.warehouse.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { currencyCode: true } }),
  ]);

  const canManageSales = session.user.permissions?.includes("MANAGE_SALES") ?? false;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">{lang === "fr" ? "Ventes" : "Sales"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">{lang === "fr" ? "Devis" : "Quotes"}</h1>
        <p className="text-sm text-[var(--admin-muted)]">
          {lang === "fr"
            ? "Preparez les devis, appliquez les taxes et convertissez les devis approuves en commandes."
            : "Draft quotes, apply taxes, and convert approved quotes into orders."}
        </p>
      </div>
      <SalesQuotesManager
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
        currencyCode={company?.currencyCode ?? "USD"}
      />
    </div>
  );
}
