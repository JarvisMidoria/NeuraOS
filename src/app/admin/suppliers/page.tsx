import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SuppliersManager } from "@/components/admin/suppliers/suppliers-manager";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function SuppliersPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">{lang === "fr" ? "Achats" : "Purchases"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">{lang === "fr" ? "Fournisseurs" : "Suppliers"}</h1>
        <p className="text-sm text-[var(--admin-muted)]">
          {lang === "fr"
            ? "Maintenez les contacts fournisseurs utilises pour l'approvisionnement."
            : "Maintain supplier contacts used for procurement."}
        </p>
      </div>
      <SuppliersManager lang={lang} />
    </div>
  );
}
