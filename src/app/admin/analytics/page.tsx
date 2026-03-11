import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getAdminLang } from "@/lib/admin-preferences";
import { getAnalyticsSnapshot } from "@/lib/analytics-service";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";

type AnalyticsPageProps = {
  searchParams: Promise<{ months?: string }>;
};

function parseMonths(input?: string) {
  const value = Number(input);
  if (value === 3 || value === 6 || value === 12) return value;
  return 6;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  DRAFT: { en: "Draft", fr: "Brouillon" },
  SENT: { en: "Sent", fr: "Envoye" },
  APPROVED: { en: "Approved", fr: "Approuve" },
  REJECTED: { en: "Rejected", fr: "Rejete" },
  CONFIRMED: { en: "Confirmed", fr: "Confirme" },
  CONVERTED: { en: "Converted", fr: "Converti" },
  FULFILLED: { en: "Fulfilled", fr: "Livre" },
  CLOSED: { en: "Closed", fr: "Cloture" },
  PARTIAL: { en: "Partial", fr: "Partiel" },
  PARTIALLY_RECEIVED: { en: "Partially received", fr: "Partiellement recu" },
  RECEIVED: { en: "Received", fr: "Recu" },
  CANCELLED: { en: "Cancelled", fr: "Annule" },
};

const ANALYTICS_METRIC_LINKS: Record<string, string> = {
  sales: "/admin/sales/orders",
  purchases: "/admin/purchases/orders",
  quoteConv: "/admin/sales/quotes",
  openPo: "/admin/purchases/orders",
};

export default async function AdminAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const session = await auth();
  const user = session?.user;

  if (!user?.companyId || !user.permissions?.includes("VIEW_DASHBOARD")) {
    notFound();
  }

  const params = await searchParams;
  const months = parseMonths(params.months);
  const lang = await getAdminLang();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const [snapshot, company] = await Promise.all([
    getAnalyticsSnapshot(user.companyId, months),
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { currencyCode: true },
    }),
  ]);
  const currencyCode = company?.currencyCode ?? "USD";

  const maxSales = Math.max(...snapshot.monthly.map((entry) => entry.sales), 1);
  const maxPurchases = Math.max(...snapshot.monthly.map((entry) => entry.purchases), 1);

  const text = {
    title: lang === "fr" ? "Analytics" : "Analytics",
    subtitle: lang === "fr" ? "Pilotage ventes, achats, stock et execution" : "Sales, purchasing, stock and execution insights",
    period: lang === "fr" ? "Periode" : "Period",
    refreshed: lang === "fr" ? "Mis a jour" : "Refreshed",
    sales: lang === "fr" ? "Ventes" : "Sales",
    purchases: lang === "fr" ? "Achats" : "Purchases",
    quoteConv: lang === "fr" ? "Conversion devis" : "Quote conversion",
    openPo: lang === "fr" ? "PO ouverts" : "Open purchase orders",
    monthlyTrend: lang === "fr" ? "Tendance mensuelle" : "Monthly trend",
    topClients: lang === "fr" ? "Top clients" : "Top clients",
    topProducts: lang === "fr" ? "Top produits" : "Top products",
    noData: lang === "fr" ? "Aucune donnee sur la periode." : "No data in selected period.",
    quoteFunnel: lang === "fr" ? "Funnel devis" : "Quote funnel",
    openQuotesFiltered: lang === "fr" ? "Ouvrir devis filtres" : "Open filtered quotes",
    stockAlerts: lang === "fr" ? "Alertes stock" : "Stock alerts",
    lowStock: lang === "fr" ? "Stock bas" : "Low stock",
    outStock: lang === "fr" ? "Rupture" : "Out of stock",
    logistics: lang === "fr" ? "Execution logistique" : "Logistics execution",
    orders: lang === "fr" ? "commandes" : "orders",
    units: lang === "fr" ? "u" : "units",
    seeStock: lang === "fr" ? "Voir stock" : "Open inventory",
  };

  return (
    <div className="space-y-6">
      <section className="liquid-surface rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--admin-text)]">{text.title}</h1>
            <p className="text-sm text-[var(--admin-muted)]">{text.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[3, 6, 12].map((value) => (
              <Link
                key={value}
                href={`/admin/analytics?months=${value}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  months === value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 text-[var(--admin-muted)] hover:bg-zinc-100"
                }`}
              >
                {value}m
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--admin-muted)]">
          {text.period}: {months}m · {text.refreshed} {new Date(snapshot.timestamp).toLocaleString(locale)}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={ANALYTICS_METRIC_LINKS.sales} className="group liquid-surface rounded-2xl p-5 transition hover:border-indigo-200 hover:bg-zinc-50">
          <p className="text-sm text-[var(--admin-muted)]">{text.sales}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{formatCurrency(snapshot.metrics.salesTotal, locale, currencyCode, 0)}</p>
          <p className="mt-2 text-xs font-medium text-indigo-600 transition group-hover:translate-x-0.5">↗</p>
        </Link>
        <Link href={ANALYTICS_METRIC_LINKS.purchases} className="group liquid-surface rounded-2xl p-5 transition hover:border-indigo-200 hover:bg-zinc-50">
          <p className="text-sm text-[var(--admin-muted)]">{text.purchases}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{formatCurrency(snapshot.metrics.purchaseTotal, locale, currencyCode, 0)}</p>
          <p className="mt-2 text-xs font-medium text-indigo-600 transition group-hover:translate-x-0.5">↗</p>
        </Link>
        <Link href={ANALYTICS_METRIC_LINKS.quoteConv} className="group liquid-surface rounded-2xl p-5 transition hover:border-indigo-200 hover:bg-zinc-50">
          <p className="text-sm text-[var(--admin-muted)]">{text.quoteConv}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{snapshot.metrics.conversionRate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            {snapshot.metrics.quoteConverted}/{snapshot.metrics.quoteSent}
          </p>
          <p className="mt-2 text-xs font-medium text-indigo-600 transition group-hover:translate-x-0.5">↗</p>
        </Link>
        <Link href={ANALYTICS_METRIC_LINKS.openPo} className="group liquid-surface rounded-2xl p-5 transition hover:border-indigo-200 hover:bg-zinc-50">
          <p className="text-sm text-[var(--admin-muted)]">{text.openPo}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{formatNumber(snapshot.metrics.openPurchaseCount, locale)}</p>
          <p className="mt-2 text-xs font-medium text-indigo-600 transition group-hover:translate-x-0.5">↗</p>
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="liquid-surface rounded-2xl p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.monthlyTrend}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--admin-muted)]">{text.sales}</p>
              <div className="flex items-end gap-2">
                {snapshot.monthly.map((entry) => (
                  <div key={`sales-${entry.iso}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="h-32 w-full rounded bg-zinc-100 p-1">
                      <div
                        className="h-full w-full rounded bg-emerald-500"
                        style={{ transformOrigin: "bottom", transform: `scaleY(${Math.max(entry.sales / maxSales, 0.03)})` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--admin-muted)]">{new Date(entry.iso).toLocaleString(locale, { month: "short" })}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--admin-muted)]">{text.purchases}</p>
              <div className="flex items-end gap-2">
                {snapshot.monthly.map((entry) => (
                  <div key={`purchase-${entry.iso}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="h-32 w-full rounded bg-zinc-100 p-1">
                      <div
                        className="h-full w-full rounded bg-blue-500"
                        style={{ transformOrigin: "bottom", transform: `scaleY(${Math.max(entry.purchases / maxPurchases, 0.03)})` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--admin-muted)]">{new Date(entry.iso).toLocaleString(locale, { month: "short" })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="liquid-surface rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.quoteFunnel}</h2>
            <div className="mt-3 space-y-2">
              {snapshot.quoteFunnel.length === 0 && <p className="text-sm text-[var(--admin-muted)]">{text.noData}</p>}
              {snapshot.quoteFunnel.map((entry) => (
                <Link
                  key={entry.status}
                  href={`/admin/sales/quotes?status=${encodeURIComponent(entry.status)}`}
                  className="group liquid-surface flex items-center justify-between rounded-lg px-3 py-2 transition"
                  title={text.openQuotesFiltered}
                >
                  <span className="text-sm text-[var(--admin-text)]">{STATUS_LABELS[entry.status]?.[lang] ?? entry.status}</span>
                  <div className="flex items-center gap-2">
                    <span className="liquid-pill px-2 py-0.5 text-xs font-semibold text-[var(--admin-text)]">{formatNumber(entry.count, locale)}</span>
                    <span className="text-indigo-600 opacity-0 transition group-hover:opacity-100">↗</span>
                  </div>
                </Link>
              ))}
            </div>
          </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="liquid-surface rounded-2xl p-5 xl:col-span-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.topClients}</h2>
              <div className="mt-3 space-y-2">
                {snapshot.topClients.length === 0 && <p className="text-sm text-[var(--admin-muted)]">{text.noData}</p>}
                {snapshot.topClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/admin/sales/orders?clientId=${encodeURIComponent(client.id)}`}
                    className="group block liquid-surface rounded-lg p-3 transition"
                  >
                    <p className="text-sm font-semibold text-[var(--admin-text)]">{client.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{client.orders} {text.orders}</p>
                    <p className="mt-1 text-sm text-[var(--admin-text)]">{formatCurrency(client.total, locale, currencyCode)}</p>
                    <div className="mt-1 flex justify-end text-indigo-600 opacity-0 transition group-hover:opacity-100">↗</div>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.topProducts}</h2>
              <div className="mt-3 space-y-2">
                {snapshot.topProducts.length === 0 && <p className="text-sm text-[var(--admin-muted)]">{text.noData}</p>}
                {snapshot.topProducts.map((product) => (
                  <Link key={product.id} href="/admin/stock" className="group block liquid-surface rounded-lg p-3 transition">
                    <p className="text-sm font-semibold text-[var(--admin-text)]">{product.sku} · {product.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{formatNumber(product.quantity, locale)} {text.units}</p>
                    <p className="mt-1 text-sm text-[var(--admin-text)]">{formatCurrency(product.revenue, locale, currencyCode)}</p>
                    <div className="mt-1 flex justify-end text-indigo-600 opacity-0 transition group-hover:opacity-100">↗</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="space-y-4">
          <div className="liquid-surface rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.stockAlerts}</h2>
            <div className="mt-3 space-y-2">
              <Link href="/admin/stock" className="group liquid-surface flex items-center justify-between rounded-lg px-3 py-2 transition">
                <span className="text-sm text-[var(--admin-text)]">{text.lowStock}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {formatNumber(snapshot.stockAlerts.lowStockCount, locale)}
                  </span>
                  <span className="text-indigo-600 opacity-0 transition group-hover:opacity-100">↗</span>
                </div>
              </Link>
              <Link href="/admin/stock" className="group liquid-surface flex items-center justify-between rounded-lg px-3 py-2 transition">
                <span className="text-sm text-[var(--admin-text)]">{text.outStock}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {formatNumber(snapshot.stockAlerts.outOfStockCount, locale)}
                  </span>
                  <span className="text-indigo-600 opacity-0 transition group-hover:opacity-100">↗</span>
                </div>
              </Link>
            </div>
            <Link href="/admin/stock" className="mt-3 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
              {text.seeStock}
            </Link>
          </div>

          <div className="liquid-surface rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.logistics}</h2>
            <div className="mt-3 space-y-2">
              {snapshot.logisticsTasks.map((task) => (
                <Link key={task.id} href={task.href} className="group liquid-surface flex items-center justify-between rounded-lg px-3 py-2 transition">
                  <span className="text-sm text-[var(--admin-text)]">{task.label}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        task.severity === "high"
                          ? "bg-rose-100 text-rose-700"
                          : task.severity === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {formatNumber(task.count, locale)}
                    </span>
                    <span className="text-indigo-600 opacity-0 transition group-hover:opacity-100">↗</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
