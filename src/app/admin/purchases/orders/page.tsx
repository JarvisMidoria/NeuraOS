import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PurchasesOrdersManager } from "@/components/admin/purchases/purchases-orders-manager";

export default async function PurchasesOrdersPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/login");

  const companyId = session.user.companyId;
  const [suppliers, products, company] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, unitPrice: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { currencyCode: true } }),
  ]);

  const canManagePurchasing = session.user.permissions?.includes("MANAGE_PURCHASING") ?? false;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Purchases</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Purchase Orders</h1>
        <p className="text-sm text-zinc-500">Create, review and progress supplier orders.</p>
      </div>
      <PurchasesOrdersManager
        suppliers={suppliers}
        products={products.map((p) => ({ ...p, unitPrice: p.unitPrice.toString() }))}
        canManagePurchasing={canManagePurchasing}
        currencyCode={company?.currencyCode ?? "USD"}
      />
    </div>
  );
}
