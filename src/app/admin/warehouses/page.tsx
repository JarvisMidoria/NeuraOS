import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WarehousesManager } from "@/components/admin/warehouses/warehouses-manager";

export default async function WarehousesPage() {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-zinc-500">Inventory</p>
        <h1 className="text-3xl font-semibold text-zinc-900">Warehouses</h1>
        <p className="text-sm text-zinc-500">
          Define the storage locations available for inventory movements.
        </p>
      </div>
      <WarehousesManager />
    </div>
  );
}
