import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PurchasesReplenishment } from "@/components/admin/purchases/purchases-replenishment";

export default async function PurchasesReplenishmentPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Purchases</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Replenishment</h1>
        <p className="text-sm text-zinc-500">Low-stock suggestions to prioritize procurement.</p>
      </div>
      <PurchasesReplenishment />
    </div>
  );
}
