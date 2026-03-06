import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsConsole } from "@/components/admin/settings/settings-console";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  if (!session.user.permissions?.includes("ADMIN")) {
    redirect("/admin");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Administration</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500">Manage company, users, roles, taxes, stock rules, and custom fields.</p>
      </div>
      <SettingsConsole />
    </div>
  );
}
