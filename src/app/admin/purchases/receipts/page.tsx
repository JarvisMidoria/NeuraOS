import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PurchasesReceiptsManager } from "@/components/admin/purchases/purchases-receipts-manager";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function PurchasesReceiptsPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) redirect("/login");

  const companyId = session.user.companyId;
  const [warehouses, company] = await Promise.all([
    prisma.warehouse.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { currencyCode: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">
          {lang === "fr" ? "Achats" : "Purchases"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">
          {lang === "fr" ? "Receptions" : "Goods Receipts"}
        </h1>
        <p className="text-sm text-[var(--admin-muted)]">
          {lang === "fr"
            ? "Receptionnez les livraisons fournisseurs et mettez a jour le stock."
            : "Receive supplier deliveries and post inbound stock."}
        </p>
      </div>
      <PurchasesReceiptsManager warehouses={warehouses} currencyCode={company?.currencyCode ?? "USD"} lang={lang} />
    </div>
  );
}
