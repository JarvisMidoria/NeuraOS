import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminLang } from "@/lib/admin-preferences";
import Link from "next/link";

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
      _count: {
        select: {
          salesQuotes: true,
          salesOrders: true,
        },
      },
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
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{client.name}</p>
                  <div className="flex gap-1">
                    <Link
                      href={`/admin/sales/quotes?clientId=${encodeURIComponent(client.id)}`}
                      className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-200"
                    >
                      Q {client._count.salesQuotes}
                    </Link>
                    <Link
                      href={`/admin/sales/orders?clientId=${encodeURIComponent(client.id)}`}
                      className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-200"
                    >
                      O {client._count.salesOrders}
                    </Link>
                  </div>
                </div>
                <div className="mt-1 space-y-1 text-xs text-zinc-500">
                  {client.email ? (
                    <a className="block hover:text-zinc-700" href={`mailto:${client.email}`}>
                      {client.email}
                    </a>
                  ) : (
                    <p>—</p>
                  )}
                  {client.phone ? (
                    <a className="block hover:text-zinc-700" href={`tel:${client.phone}`}>
                      {client.phone}
                    </a>
                  ) : (
                    <p>—</p>
                  )}
                  <p>{client.address ?? "—"}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/sales/quotes?clientId=${encodeURIComponent(client.id)}`}
                    className="rounded-full border border-zinc-200 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50"
                  >
                    {lang === "fr" ? "Voir devis" : "Open quotes"}
                  </Link>
                  <Link
                    href={`/admin/sales/orders?clientId=${encodeURIComponent(client.id)}`}
                    className="rounded-full border border-zinc-200 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50"
                  >
                    {lang === "fr" ? "Voir commandes" : "Open orders"}
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
