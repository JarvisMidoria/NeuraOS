import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SaasConsole } from "@/components/admin/saas/saas-console";

export default async function AdminSaasPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect("/login");
  }

  if (!user.isSuperAdmin) {
    redirect("/admin");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Platform</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">SaaS Admin</h1>
        <p className="text-sm text-zinc-500">Company lifecycle, tenant bootstrap, and subscription controls.</p>
      </div>
      <SaasConsole />
    </div>
  );
}
