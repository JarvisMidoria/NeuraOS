import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAdminLang } from "@/lib/admin-preferences";
import { ClientsManager } from "@/components/admin/clients/clients-manager";

export default async function AdminClientsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.companyId) redirect("/login");
  if (!(user.permissions?.includes("MANAGE_SALES") ?? false)) {
    redirect("/admin");
  }

  const lang = await getAdminLang();

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">{lang === "fr" ? "Ventes" : "Sales"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">{lang === "fr" ? "Clients" : "Clients"}</h1>
        <p className="text-sm text-[var(--admin-muted)]">
          {lang === "fr"
            ? "Annuaire clients utilise pour les devis et le suivi commercial."
            : "Customer directory used by quotes and sales follow-up."}
        </p>
      </header>
      <ClientsManager lang={lang} />
    </section>
  );
}
