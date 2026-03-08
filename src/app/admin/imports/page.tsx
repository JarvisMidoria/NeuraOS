import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportCenter } from "@/components/admin/imports/import-center";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function AdminImportsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.companyId) {
    redirect("/login");
  }

  if (!user.permissions?.includes("ADMIN")) {
    redirect("/admin");
  }

  const lang = await getAdminLang();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Data pipeline</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {lang === "fr" ? "Import Center" : "Import Center"}
        </h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Ingestion intelligente: fichiers, photos et documents vers les bons modules ERP."
            : "Smart ingestion: files, photos and docs into the right ERP modules."}
        </p>
      </div>
      <ImportCenter lang={lang} />
    </div>
  );
}
