import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BillingConsole } from "@/components/admin/billing/billing-console";

export default async function BillingPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.companyId) {
    redirect("/login");
  }

  if (!user.permissions?.includes("ADMIN")) {
    redirect("/admin");
  }

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { companyId: user.companyId },
    select: { plan: true, status: true, renewsAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Commercial</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Billing</h1>
        <p className="text-sm text-zinc-500">Subscription, payment methods, and upgrade flow.</p>
      </div>
      <BillingConsole
        currentPlan={subscription?.plan ?? "FREE"}
        currentStatus={subscription?.status ?? "TRIALING"}
        renewsAt={subscription?.renewsAt?.toISOString() ?? null}
      />
    </div>
  );
}
