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

const PERIOD_FILTER_CLASS =
  "liquid-pill px-3 py-1 text-sm transition hover:-translate-y-0.5";

const INTERACTIVE_CARD_CLASS =
  "group liquid-surface rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_44%,var(--admin-border))] hover:bg-[color-mix(in_srgb,var(--admin-soft-bg)_88%,white_4%)]";

const INTERACTIVE_ROW_CLASS =
  "group liquid-surface flex items-center justify-between rounded-lg px-3 py-2 transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--admin-border))] hover:bg-[color-mix(in_srgb,var(--admin-soft-bg)_86%,white_3%)]";

const INTERACTIVE_BLOCK_CLASS =
  "group block liquid-surface rounded-lg p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--admin-border))] hover:bg-[color-mix(in_srgb,var(--admin-soft-bg)_86%,white_3%)]";

const STATUS_BADGE_BASE =
  "liquid-pill inline-flex w-fit items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT:
    "border-[color-mix(in_srgb,#94a3b8_58%,var(--admin-border))] bg-[color-mix(in_srgb,#64748b_22%,transparent)] text-[color-mix(in_srgb,#d5deee_86%,var(--admin-text))]",
  SENT:
    "border-[color-mix(in_srgb,#38bdf8_60%,var(--admin-border))] bg-[color-mix(in_srgb,#0ea5e9_24%,transparent)] text-[color-mix(in_srgb,#c9ecff_82%,var(--admin-text))]",
  APPROVED:
    "border-[color-mix(in_srgb,#34d399_60%,var(--admin-border))] bg-[color-mix(in_srgb,#10b981_22%,transparent)] text-[color-mix(in_srgb,#c9ffe7_82%,var(--admin-text))]",
  CONFIRMED:
    "border-[color-mix(in_srgb,#60a5fa_60%,var(--admin-border))] bg-[color-mix(in_srgb,#3b82f6_22%,transparent)] text-[color-mix(in_srgb,#d3e8ff_84%,var(--admin-text))]",
  CONVERTED:
    "border-[color-mix(in_srgb,#a78bfa_62%,var(--admin-border))] bg-[color-mix(in_srgb,#8b5cf6_22%,transparent)] text-[color-mix(in_srgb,#e8ddff_84%,var(--admin-text))]",
  REJECTED:
    "border-[color-mix(in_srgb,#fb7185_62%,var(--admin-border))] bg-[color-mix(in_srgb,#f43f5e_24%,transparent)] text-[color-mix(in_srgb,#ffd8df_86%,var(--admin-text))]",
  FULFILLED:
    "border-[color-mix(in_srgb,#2dd4bf_60%,var(--admin-border))] bg-[color-mix(in_srgb,#14b8a6_22%,transparent)] text-[color-mix(in_srgb,#c9fff4_84%,var(--admin-text))]",
  CLOSED:
    "border-[color-mix(in_srgb,var(--admin-border)_86%,transparent)] bg-[color-mix(in_srgb,var(--admin-soft-bg)_84%,transparent)] text-[var(--admin-text)]",
  PARTIAL:
    "border-[color-mix(in_srgb,#fbbf24_62%,var(--admin-border))] bg-[color-mix(in_srgb,#f59e0b_24%,transparent)] text-[color-mix(in_srgb,#ffe9b6_85%,var(--admin-text))]",
  PARTIALLY_RECEIVED:
    "border-[color-mix(in_srgb,#22d3ee_60%,var(--admin-border))] bg-[color-mix(in_srgb,#06b6d4_22%,transparent)] text-[color-mix(in_srgb,#cff7ff_84%,var(--admin-text))]",
  RECEIVED:
    "border-[color-mix(in_srgb,#2dd4bf_60%,var(--admin-border))] bg-[color-mix(in_srgb,#14b8a6_22%,transparent)] text-[color-mix(in_srgb,#c9fff4_84%,var(--admin-text))]",
  CANCELLED:
    "border-[color-mix(in_srgb,#fb7185_62%,var(--admin-border))] bg-[color-mix(in_srgb,#f43f5e_24%,transparent)] text-[color-mix(in_srgb,#ffd8df_86%,var(--admin-text))]",
};

const COUNT_BADGE_CLASSES = {
  low:
    "border-[color-mix(in_srgb,#34d399_60%,var(--admin-border))] bg-[color-mix(in_srgb,#10b981_22%,transparent)] text-[color-mix(in_srgb,#c9ffe7_82%,var(--admin-text))]",
  medium:
    "border-[color-mix(in_srgb,#fbbf24_62%,var(--admin-border))] bg-[color-mix(in_srgb,#f59e0b_24%,transparent)] text-[color-mix(in_srgb,#ffe9b6_85%,var(--admin-text))]",
  high:
    "border-[color-mix(in_srgb,#fb7185_62%,var(--admin-border))] bg-[color-mix(in_srgb,#f43f5e_24%,transparent)] text-[color-mix(in_srgb,#ffd8df_86%,var(--admin-text))]",
} as const;

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
                className={`${PERIOD_FILTER_CLASS} ${
                  months === value
                    ? "liquid-selected"
                    : "text-[var(--admin-muted)]"
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
        <Link href={ANALYTICS_METRIC_LINKS.sales} className={INTERACTIVE_CARD_CLASS}>
          <p className="text-sm text-[var(--admin-muted)]">{text.sales}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{formatCurrency(snapshot.metrics.salesTotal, locale, currencyCode, 0)}</p>
          <p className="mt-2 text-xs font-medium text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] transition group-hover:translate-x-0.5">↗</p>
        </Link>
        <Link href={ANALYTICS_METRIC_LINKS.purchases} className={INTERACTIVE_CARD_CLASS}>
          <p className="text-sm text-[var(--admin-muted)]">{text.purchases}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{formatCurrency(snapshot.metrics.purchaseTotal, locale, currencyCode, 0)}</p>
          <p className="mt-2 text-xs font-medium text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] transition group-hover:translate-x-0.5">↗</p>
        </Link>
        <Link href={ANALYTICS_METRIC_LINKS.quoteConv} className={INTERACTIVE_CARD_CLASS}>
          <p className="text-sm text-[var(--admin-muted)]">{text.quoteConv}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{snapshot.metrics.conversionRate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            {snapshot.metrics.quoteConverted}/{snapshot.metrics.quoteSent}
          </p>
          <p className="mt-2 text-xs font-medium text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] transition group-hover:translate-x-0.5">↗</p>
        </Link>
        <Link href={ANALYTICS_METRIC_LINKS.openPo} className={INTERACTIVE_CARD_CLASS}>
          <p className="text-sm text-[var(--admin-muted)]">{text.openPo}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">{formatNumber(snapshot.metrics.openPurchaseCount, locale)}</p>
          <p className="mt-2 text-xs font-medium text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] transition group-hover:translate-x-0.5">↗</p>
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
                    <div className="h-32 w-full rounded border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-soft-bg)_88%,transparent)] p-1">
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
                    <div className="h-32 w-full rounded border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-soft-bg)_88%,transparent)] p-1">
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
                  className={INTERACTIVE_ROW_CLASS}
                  title={text.openQuotesFiltered}
                >
                  <span className="text-sm text-[var(--admin-text)]">{STATUS_LABELS[entry.status]?.[lang] ?? entry.status}</span>
                  <div className="flex items-center gap-2">
                    <span className={`${STATUS_BADGE_BASE} ${STATUS_BADGE_CLASSES[entry.status] ?? "border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-soft-bg)_84%,transparent)] text-[var(--admin-text)]"}`}>{formatNumber(entry.count, locale)}</span>
                    <span className="text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] opacity-0 transition group-hover:opacity-100">↗</span>
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
                    className={INTERACTIVE_BLOCK_CLASS}
                  >
                    <p className="text-sm font-semibold text-[var(--admin-text)]">{client.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{client.orders} {text.orders}</p>
                    <p className="mt-1 text-sm text-[var(--admin-text)]">{formatCurrency(client.total, locale, currencyCode)}</p>
                    <div className="mt-1 flex justify-end text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] opacity-0 transition group-hover:opacity-100">↗</div>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.topProducts}</h2>
              <div className="mt-3 space-y-2">
                {snapshot.topProducts.length === 0 && <p className="text-sm text-[var(--admin-muted)]">{text.noData}</p>}
                {snapshot.topProducts.map((product) => (
                  <Link key={product.id} href="/admin/stock" className={INTERACTIVE_BLOCK_CLASS}>
                    <p className="text-sm font-semibold text-[var(--admin-text)]">{product.sku} · {product.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{formatNumber(product.quantity, locale)} {text.units}</p>
                    <p className="mt-1 text-sm text-[var(--admin-text)]">{formatCurrency(product.revenue, locale, currencyCode)}</p>
                    <div className="mt-1 flex justify-end text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] opacity-0 transition group-hover:opacity-100">↗</div>
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
              <Link href="/admin/stock" className={INTERACTIVE_ROW_CLASS}>
                <span className="text-sm text-[var(--admin-text)]">{text.lowStock}</span>
                <div className="flex items-center gap-2">
                  <span className={`${STATUS_BADGE_BASE} ${COUNT_BADGE_CLASSES.medium}`}>
                    {formatNumber(snapshot.stockAlerts.lowStockCount, locale)}
                  </span>
                  <span className="text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] opacity-0 transition group-hover:opacity-100">↗</span>
                </div>
              </Link>
              <Link href="/admin/stock" className={INTERACTIVE_ROW_CLASS}>
                <span className="text-sm text-[var(--admin-text)]">{text.outStock}</span>
                <div className="flex items-center gap-2">
                  <span className={`${STATUS_BADGE_BASE} ${COUNT_BADGE_CLASSES.high}`}>
                    {formatNumber(snapshot.stockAlerts.outOfStockCount, locale)}
                  </span>
                  <span className="text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] opacity-0 transition group-hover:opacity-100">↗</span>
                </div>
              </Link>
            </div>
            <Link href="/admin/stock" className="liquid-pill mt-3 inline-flex w-fit px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-text)]">
              {text.seeStock}
            </Link>
          </div>

          <div className="liquid-surface rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.logistics}</h2>
            <div className="mt-3 space-y-2">
              {snapshot.logisticsTasks.map((task) => (
                <Link key={task.id} href={task.href} className={INTERACTIVE_ROW_CLASS}>
                  <span className="text-sm text-[var(--admin-text)]">{task.label}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`${STATUS_BADGE_BASE} ${
                        task.severity === "high"
                          ? COUNT_BADGE_CLASSES.high
                          : task.severity === "medium"
                            ? COUNT_BADGE_CLASSES.medium
                            : COUNT_BADGE_CLASSES.low
                      }`}
                    >
                      {formatNumber(task.count, locale)}
                    </span>
                    <span className="text-[color-mix(in_srgb,var(--accent)_74%,var(--admin-text))] opacity-0 transition group-hover:opacity-100">↗</span>
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
