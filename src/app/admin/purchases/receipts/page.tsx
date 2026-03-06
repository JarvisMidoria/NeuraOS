import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PurchasesReceiptsManager } from "@/components/admin/purchases/purchases-receipts-manager";

export default async function PurchasesReceiptsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/login");

  const companyId = session.user.companyId;
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Purchases</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Goods Receipts</h1>
        <p className="text-sm text-zinc-500">Receive supplier deliveries and post inbound stock.</p>
      </div>
      <PurchasesReceiptsManager warehouses={warehouses} />
    </div>
  );
}
