import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAdminLang } from "@/lib/admin-preferences";
import { resolveHrAccess } from "@/lib/hr-access";
import { HrImportCenter } from "@/components/admin/hr/hr-import-center";

export default async function HrImportsPage() {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  try {
    await resolveHrAccess(session);
  } catch {
    redirect("/admin");
  }

  const lang = await getAdminLang();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">HR pipeline</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {lang === "fr" ? "Import RH" : "HR Import Center"}
        </h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Import separe pour les donnees RH: employes, structure, historique et documents."
            : "Separate import pipeline for HR data: employees, structure, history and documents."}
        </p>
      </div>
      <HrImportCenter lang={lang} />
    </div>
  );
}
