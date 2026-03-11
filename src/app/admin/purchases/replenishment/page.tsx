import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PurchasesReplenishment } from "@/components/admin/purchases/purchases-replenishment";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function PurchasesReplenishmentPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">
          {lang === "fr" ? "Achats" : "Purchases"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">
          {lang === "fr" ? "Reapprovisionnement" : "Replenishment"}
        </h1>
        <p className="text-sm text-[var(--admin-muted)]">
          {lang === "fr"
            ? "Suggestions de reappro pour traiter les produits sous seuil."
            : "Low-stock suggestions to prioritize procurement."}
        </p>
      </div>
      <PurchasesReplenishment lang={lang} />
    </div>
  );
}
