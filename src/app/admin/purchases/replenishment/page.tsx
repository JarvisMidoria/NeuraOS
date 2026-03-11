import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PurchasesReplenishment } from "@/components/admin/purchases/purchases-replenishment";

export default async function PurchasesReplenishmentPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">Purchases</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">Replenishment</h1>
        <p className="text-sm text-[var(--admin-muted)]">Low-stock suggestions to prioritize procurement.</p>
      </div>
      <PurchasesReplenishment />
    </div>
  );
}
