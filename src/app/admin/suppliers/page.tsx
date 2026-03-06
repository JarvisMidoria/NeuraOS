import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SuppliersManager } from "@/components/admin/suppliers/suppliers-manager";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Purchases</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Suppliers</h1>
        <p className="text-sm text-zinc-500">Maintain supplier contacts used for procurement.</p>
      </div>
      <SuppliersManager />
    </div>
  );
}
