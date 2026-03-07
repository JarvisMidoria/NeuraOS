import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function AdminClientsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/login");

  const lang = await getAdminLang();
  const clients = await prisma.client.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      createdAt: true,
    },
  });

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === "fr" ? "Ventes" : "Sales"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{lang === "fr" ? "Clients" : "Clients"}</h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Annuaire clients utilise pour les devis et le suivi commercial."
            : "Customer directory used by quotes and sales follow-up."}
        </p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {lang === "fr" ? "Total clients" : "Total clients"}: {clients.length}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {clients.length === 0 ? (
            <p className="text-sm text-zinc-500">{lang === "fr" ? "Aucun client" : "No clients yet"}</p>
          ) : (
            clients.map((client) => (
              <article key={client.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <p className="text-sm font-semibold text-zinc-900">{client.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{client.email ?? "—"}</p>
                <p className="text-xs text-zinc-500">{client.phone ?? "—"}</p>
                <p className="text-xs text-zinc-500">{client.address ?? "—"}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
