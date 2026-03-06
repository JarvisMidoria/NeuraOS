import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WarehousesManager } from "@/components/admin/warehouses/warehouses-manager";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function WarehousesPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === "fr" ? "Stock" : "Inventory"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {lang === "fr" ? "Entrepots" : "Warehouses"}
        </h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Definissez les lieux de stockage disponibles pour les mouvements de stock."
            : "Define the storage locations available for inventory movements."}
        </p>
      </div>
      <WarehousesManager lang={lang} />
    </div>
  );
}
