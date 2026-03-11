import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminLang } from "@/lib/admin-preferences";
import { AuditConsole } from "@/components/admin/audit/audit-console";

export default async function AdminAuditPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.companyId) {
    redirect("/login");
  }

  if (!user.permissions?.includes("ADMIN")) {
    redirect("/admin");
  }

  const lang = await getAdminLang();
  const text = {
    heading: lang === "fr" ? "Journal d'audit" : "Audit log",
    subtitle:
      lang === "fr"
        ? "Traçabilite complete des actions sensibles avec filtres et export."
        : "Full traceability of sensitive actions with filters and export.",
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">Compliance</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">{text.heading}</h1>
        <p className="text-sm text-[var(--admin-muted)]">{text.subtitle}</p>
      </div>
      <AuditConsole lang={lang} />
    </div>
  );
}
