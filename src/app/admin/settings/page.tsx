import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsConsole } from "@/components/admin/settings/settings-console";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function SettingsPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  if (!session.user.permissions?.includes("ADMIN")) {
    redirect("/admin");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">
          {lang === "fr" ? "Administration" : "Administration"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">
          {lang === "fr" ? "Parametres" : "Settings"}
        </h1>
        <p className="text-sm text-[var(--admin-muted)]">
          {lang === "fr"
            ? "Gerez l'entreprise, les utilisateurs, les roles, les taxes, les regles de stock et les champs personnalises."
            : "Manage company, users, roles, taxes, stock rules, and custom fields."}
        </p>
      </div>
      <SettingsConsole lang={lang} />
    </div>
  );
}
