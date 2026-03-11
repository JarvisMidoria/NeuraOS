import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getAdminLang } from "@/lib/admin-preferences";
import { getDashboardSnapshotCached } from "@/lib/dashboard-service";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";

type AdminDashboardProps = {
  searchParams: Promise<{ months?: string }>;
};

function parseMonths(input?: string) {
  const value = Number(input);
  if (value === 3 || value === 6 || value === 12) return value;
  return 6;
}

function formatMetric(
  value: number,
  formatter: "currency" | "number" | "percent",
  locale: string,
  currencyCode: string,
) {
  const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const percentFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (formatter === "currency") return formatCurrency(value, locale, currencyCode, 0);
  if (formatter === "percent") return `${percentFormatter.format(value)}%`;
  return numberFormatter.format(value);
}

const TREND_SYMBOL: Record<"up" | "down" | "flat", string> = {
  up: "↗",
  down: "↘",
  flat: "→",
};

const TREND_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-[var(--admin-muted)]",
};

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  DRAFT: { en: "Draft", fr: "Brouillon" },
  SENT: { en: "Sent", fr: "Envoye" },
  APPROVED: { en: "Approved", fr: "Approuve" },
  REJECTED: { en: "Rejected", fr: "Rejete" },
  CONVERTED: { en: "Converted", fr: "Converti" },
  CONFIRMED: { en: "Confirmed", fr: "Confirme" },
  FULFILLED: { en: "Fulfilled", fr: "Livre" },
  CLOSED: { en: "Closed", fr: "Cloture" },
  PARTIAL: { en: "Partial", fr: "Partiel" },
  PARTIALLY_RECEIVED: { en: "Partially received", fr: "Partiellement recu" },
};

const TYPE_LABELS: Record<string, { en: string; fr: string }> = {
  "Sales Order": { en: "Sales Order", fr: "Commande client" },
  "Sales Quote": { en: "Sales Quote", fr: "Devis" },
  "Purchase Order": { en: "Purchase Order", fr: "Commande achat" },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CONVERTED: "bg-violet-100 text-violet-700",
  REJECTED: "bg-rose-100 text-rose-700",
  FULFILLED: "bg-teal-100 text-teal-700",
  CLOSED: "bg-zinc-200 text-[var(--admin-text)]",
  PARTIAL: "bg-amber-100 text-amber-700",
  PARTIALLY_RECEIVED: "bg-cyan-100 text-cyan-700",
};

const KPI_LINKS: Record<string, string> = {
  "sales-mtd": "/admin/sales/orders",
  "avg-order": "/admin/sales/orders",
  "quote-rate": "/admin/sales/quotes",
  "open-pos": "/admin/purchases/orders",
};

export default async function AdminDashboard({ searchParams }: AdminDashboardProps) {
  const session = await auth();
  const user = session?.user;
  const lang = await getAdminLang();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const params = await searchParams;
  const months = parseMonths(params.months);

  if (!user?.companyId) {
    notFound();
  }

  if (!user.permissions?.includes("VIEW_DASHBOARD")) {
    notFound();
  }

  const [snapshot, company] = await Promise.all([
    getDashboardSnapshotCached(user.companyId, months),
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { currencyCode: true },
    }),
  ]);
  const currencyCode = company?.currencyCode ?? "USD";
  const maxMonthlyValue = Math.max(...snapshot.monthlySales.map((entry) => entry.total), 1);
  const recentLowStock = snapshot.lowStock.slice(0, 6);
  const displayName = lang === "fr" ? "Ghali" : user.name ?? "Admin";
  const text = {
    dashboard: lang === "fr" ? "Tableau de bord" : "Dashboard",
    welcome: lang === "fr" ? "Bonjour" : "Welcome back",
    company: lang === "fr" ? "Societe" : "Company",
    keyMetrics: lang === "fr" ? "Indicateurs cles" : "Key metrics",
    salesTrend: lang === "fr" ? "Tendance ventes et stock" : "Sales trend and inventory",
    revenue: lang === "fr" ? "Chiffre d'affaires" : "Revenue",
    trailing: lang === "fr" ? `${months} derniers mois` : `Trailing ${months} months`,
    refreshed: lang === "fr" ? "Mis a jour" : "Auto-refreshed",
    inventory: lang === "fr" ? "Stock" : "Inventory",
    lowStock: lang === "fr" ? "Alertes stock bas" : "Low stock alerts",
    viewStock: lang === "fr" ? "Voir le stock" : "View stock",
    noLowStock:
      lang === "fr"
        ? "Tous les articles suivis sont au-dessus des seuils."
        : "All tracked items are within thresholds.",
    onHand: lang === "fr" ? "Disponible" : "On hand",
    threshold: lang === "fr" ? "Seuil" : "Threshold",
    suggested: lang === "fr" ? "Reappro recommandee" : "Suggested replenishment",
    docsAndTasks: lang === "fr" ? "Documents et taches" : "Documents and tasks",
    period: lang === "fr" ? "Periode" : "Period",
    latest: lang === "fr" ? "Recents" : "Latest",
    documents: lang === "fr" ? "Documents" : "Documents",
    noTransactions:
      lang === "fr" ? "Aucune transaction enregistree." : "No transactions recorded yet.",
    operations: lang === "fr" ? "Operations" : "Operations",
    todo: lang === "fr" ? "A faire" : "To-do",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">{text.dashboard}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">
          {text.welcome}, {displayName}
        </h1>
        <p className="text-sm text-[var(--admin-muted)]">
          {text.company}: {user.companyId}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[3, 6, 12].map((value) => (
            <Link
              key={value}
              href={`/admin?months=${value}`}
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

      <section aria-label={text.keyMetrics} className="perf-section grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.kpis.map((kpi) => (
          <Link
            key={kpi.id}
            href={KPI_LINKS[kpi.id] ?? "/admin"}
            className="group relative liquid-surface rounded-2xl p-5 transition hover:border-indigo-200 hover:bg-zinc-50"
          >
            <span className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-[var(--admin-muted)] transition group-hover:border-indigo-200 group-hover:text-indigo-600">
              <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H19V15" />
                <path d="M19 5L5 19" />
              </svg>
            </span>
            <p className="text-sm text-[var(--admin-muted)]">
              {lang === "fr"
                ? kpi.label
                    .replace("Sales (period)", "Ventes (periode)")
                    .replace("Avg order value", "Panier moyen")
                    .replace("Quote win rate", "Taux de gain devis")
                    .replace("Open PO value", "Valeur commandes achat ouvertes")
                : kpi.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--admin-text)]">
              {formatMetric(kpi.value, kpi.formatter, locale, currencyCode)}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className={`flex items-center gap-1 font-medium ${TREND_COLOR[kpi.trend]}`}>
                <span aria-hidden>{TREND_SYMBOL[kpi.trend]}</span>
                {kpi.deltaPct.toFixed(1)}%
              </span>
              {kpi.helper && (
                <span className="text-xs text-[var(--admin-muted)]">
                  {lang === "fr"
                    ? kpi.helper
                        .replace("vs prev month", "vs periode precedente")
                        .replace("fulfilled orders", "commandes livrees")
                        .replace("month window", "mois")
                        .replace("active", "actif")
                    : kpi.helper}
                </span>
              )}
            </div>
          </Link>
        ))}
      </section>

      <section className="perf-section grid gap-6 lg:grid-cols-3" aria-label={text.salesTrend}>
        <div className="liquid-surface rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-[var(--admin-muted)]">{text.revenue}</p>
              <h2 className="text-xl font-semibold text-[var(--admin-text)]">{text.trailing}</h2>
            </div>
            <span className="text-xs text-[var(--admin-muted)]">
              {text.period}: {months}m · {text.refreshed} {new Date(snapshot.timestamp).toLocaleString(locale)}
            </span>
          </div>
          <div className="mt-6 flex items-end gap-4" role="figure" aria-label={text.revenue}>
            {snapshot.monthlySales.map((entry) => {
              const percentage = Math.round((entry.total / maxMonthlyValue) * 100);
              return (
                <div key={entry.iso} className="flex flex-1 flex-col items-center gap-3">
                  <div className="flex h-48 w-full items-end rounded-xl bg-zinc-100 p-2">
                    <div
                      className="w-full rounded-lg bg-gradient-to-t from-emerald-500 to-emerald-400"
                      style={{ height: `${percentage || 4}%` }}
                      aria-label={`${entry.month} ${text.revenue} ${formatMetric(entry.total, "currency", locale, currencyCode)}`}
                    />
                  </div>
                  <div className="text-center text-sm text-[var(--admin-muted)]">
                    <p className="font-medium text-[var(--admin-text)]">
                      {new Date(entry.iso).toLocaleString(locale, { month: "short" })}
                    </p>
                    <p>{formatMetric(entry.total, "currency", locale, currencyCode)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="liquid-surface rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-[var(--admin-muted)]">{text.inventory}</p>
              <h2 className="text-xl font-semibold text-[var(--admin-text)]">{text.lowStock}</h2>
            </div>
            <Link href="/admin/stock" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
              {text.viewStock}
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {recentLowStock.length === 0 && (
              <p className="text-sm text-[var(--admin-muted)]">{text.noLowStock}</p>
            )}
            {recentLowStock.map((item) => {
              const current = Number(item.currentStock ?? 0);
              const threshold = Number(item.lowStockThreshold ?? 0);
              const deficit = Math.max(threshold - current, 0);
              return (
                <Link
                  key={item.id}
                  href="/admin/stock"
                  className="group block liquid-surface rounded-xl p-4 transition"
                >
                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                    {item.sku} · {item.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-[var(--admin-muted)]">
                      {text.onHand}{" "}
                      <span className="font-semibold text-[var(--admin-text)]">
                        {formatMetric(current, "number", locale, currencyCode)}
                      </span>
                    </span>
                    <span className="text-[var(--admin-muted)]">
                      {text.threshold} {formatMetric(threshold, "number", locale, currencyCode)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${Math.min((current / Math.max(threshold, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-rose-600">
                    {text.suggested}: {formatMetric(Math.ceil(deficit), "number", locale, currencyCode)}
                  </p>
                  <div className="mt-2 flex justify-end text-indigo-600 opacity-0 transition group-hover:opacity-100">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5H19V15" />
                      <path d="M19 5L5 19" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="perf-section grid gap-6 lg:grid-cols-3" aria-label={text.docsAndTasks}>
        <div className="liquid-surface rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-[var(--admin-muted)]">{text.latest}</p>
              <h2 className="text-xl font-semibold text-[var(--admin-text)]">{text.documents}</h2>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {snapshot.latestDocuments.map((doc) => (
              <Link
                key={`${doc.type}-${doc.id}`}
                href={doc.href}
                className="group block liquid-surface rounded-2xl p-4 transition"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(120px,1fr)_minmax(170px,1fr)_auto_120px_auto] sm:items-center sm:gap-4">
                  <div className="flex min-w-[7rem] flex-col">
                    <span className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                      {(TYPE_LABELS[doc.type]?.[lang] ?? doc.type) as string}
                    </span>
                    <span className="font-semibold text-[var(--admin-text)]">{doc.code}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--admin-text)]">{doc.counterpart}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{new Date(doc.date).toLocaleDateString(locale)}</p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[doc.status] ?? "bg-zinc-100 text-[var(--admin-text)]"}`}
                  >
                    {(STATUS_LABELS[doc.status]?.[lang] ?? doc.status) as string}
                  </span>
                  <p className="text-sm font-semibold text-[var(--admin-text)] sm:text-right">
                    {doc.total === null ? "—" : formatMetric(doc.total, "currency", locale, currencyCode)}
                  </p>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-[var(--admin-muted)] transition group-hover:border-indigo-200 group-hover:text-indigo-600">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5H19V15" />
                      <path d="M19 5L5 19" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
            {snapshot.latestDocuments.length === 0 && (
              <p className="py-4 text-sm text-[var(--admin-muted)]">{text.noTransactions}</p>
            )}
          </div>
        </div>

        <div className="liquid-surface rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-[var(--admin-muted)]">{text.operations}</p>
              <h2 className="text-xl font-semibold text-[var(--admin-text)]">{text.todo}</h2>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {snapshot.operationalTodo.map((task) => (
              <Link key={task.id} href={task.href} className="group block liquid-surface rounded-2xl p-4 transition">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-[var(--admin-text)]">
                    {lang === "fr"
                      ? task.label
                          .replace("Quotes expiring in 7 days", "Devis expirant sous 7 jours")
                          .replace("Orders awaiting confirmation", "Commandes en attente de confirmation")
                          .replace("Receipts overdue", "Receptions en retard")
                      : task.label}
                  </p>
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                      task.severity === "high"
                        ? "bg-rose-100 text-rose-600"
                        : task.severity === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {formatMetric(task.count, "number", locale, currencyCode)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  {lang === "fr"
                    ? task.description
                        .replace("Send reminders or close out quotes before validity lapses.", "Relancer ou cloturer les devis avant expiration.")
                        .replace("Confirm approved orders to release fulfillment tasks.", "Confirmer les commandes approuvees pour lancer la preparation.")
                        .replace("Follow up with suppliers on late inbound shipments.", "Relancer les fournisseurs sur les livraisons en retard.")
                    : task.description}
                </p>
                <div className="mt-2 flex justify-end text-indigo-600 opacity-0 transition group-hover:opacity-100">
                  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H19V15" />
                    <path d="M19 5L5 19" />
                  </svg>
                </div>
              </Link>
            ))}
            </div>
          </div>
      </section>
    </div>
  );
}
