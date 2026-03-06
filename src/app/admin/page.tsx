import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getAdminLang } from "@/lib/admin-preferences";
import { getDashboardSnapshot } from "@/lib/dashboard-service";

function formatMetric(
  value: number,
  formatter: "currency" | "number" | "percent",
  locale: string,
) {
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const percentFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (formatter === "currency") return currencyFormatter.format(value);
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
  flat: "text-zinc-500",
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

export default async function AdminDashboard() {
  const session = await auth();
  const user = session?.user;
  const lang = await getAdminLang();
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  if (!user?.companyId) {
    notFound();
  }

  if (!user.permissions?.includes("VIEW_DASHBOARD")) {
    notFound();
  }

  const snapshot = await getDashboardSnapshot(user.companyId);
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
    trailing: lang === "fr" ? "6 derniers mois" : "Trailing 6 months",
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
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{text.dashboard}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {text.welcome}, {displayName}
        </h1>
        <p className="text-sm text-zinc-500">
          {text.company}: {user.companyId}
        </p>
      </div>

      <section aria-label={text.keyMetrics} className="perf-section grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.kpis.map((kpi) => (
          <div key={kpi.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">
              {lang === "fr"
                ? kpi.label
                    .replace("Sales (MTD)", "Ventes (MTD)")
                    .replace("Avg order value", "Panier moyen")
                    .replace("Quote win rate", "Taux de gain devis")
                    .replace("Open PO value", "Valeur commandes achat ouvertes")
                : kpi.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
              {formatMetric(kpi.value, kpi.formatter, locale)}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className={`flex items-center gap-1 font-medium ${TREND_COLOR[kpi.trend]}`}>
                <span aria-hidden>{TREND_SYMBOL[kpi.trend]}</span>
                {kpi.deltaPct.toFixed(1)}%
              </span>
              {kpi.helper && (
                <span className="text-xs text-zinc-500">
                  {lang === "fr"
                    ? kpi.helper
                        .replace("vs prev month", "vs mois precedent")
                        .replace("fulfilled orders", "commandes livrees")
                        .replace("30-day window", "fenetre 30 jours")
                        .replace("active", "actif")
                    : kpi.helper}
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="perf-section grid gap-6 lg:grid-cols-3" aria-label={text.salesTrend}>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">{text.revenue}</p>
              <h2 className="text-xl font-semibold text-zinc-900">{text.trailing}</h2>
            </div>
            <span className="text-xs text-zinc-500">
              {text.refreshed} {new Date(snapshot.timestamp).toLocaleString(locale)}
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
                      aria-label={`${entry.month} ${text.revenue} ${formatMetric(entry.total, "currency", locale)}`}
                    />
                  </div>
                  <div className="text-center text-sm text-zinc-500">
                    <p className="font-medium text-zinc-900">
                      {new Date(entry.iso).toLocaleString(locale, { month: "short" })}
                    </p>
                    <p>{formatMetric(entry.total, "currency", locale)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">{text.inventory}</p>
              <h2 className="text-xl font-semibold text-zinc-900">{text.lowStock}</h2>
            </div>
            <Link href="/admin/stock" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
              {text.viewStock}
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {recentLowStock.length === 0 && (
              <p className="text-sm text-zinc-500">{text.noLowStock}</p>
            )}
            {recentLowStock.map((item) => {
              const current = Number(item.currentStock ?? 0);
              const threshold = Number(item.lowStockThreshold ?? 0);
              const deficit = Math.max(threshold - current, 0);
              return (
                <div key={item.id} className="rounded-xl border border-zinc-100 p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {item.sku} · {item.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-500">
                      {text.onHand}{" "}
                      <span className="font-semibold text-zinc-900">
                        {formatMetric(current, "number", locale)}
                      </span>
                    </span>
                    <span className="text-zinc-500">
                      {text.threshold} {formatMetric(threshold, "number", locale)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${Math.min((current / Math.max(threshold, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-rose-600">
                    {text.suggested}: {formatMetric(Math.ceil(deficit), "number", locale)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="perf-section grid gap-6 lg:grid-cols-3" aria-label={text.docsAndTasks}>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">{text.latest}</p>
              <h2 className="text-xl font-semibold text-zinc-900">{text.documents}</h2>
            </div>
          </div>
          <div className="mt-4 divide-y divide-zinc-100">
            {snapshot.latestDocuments.map((doc) => (
              <Link
                key={`${doc.type}-${doc.id}`}
                href={doc.href}
                className="grid gap-2 py-4 transition hover:bg-zinc-50 sm:grid-cols-[minmax(120px,1fr)_minmax(170px,1fr)_auto_120px] sm:items-center sm:gap-4"
              >
                <div className="flex min-w-[7rem] flex-col">
                  <span className="text-xs uppercase tracking-wide text-zinc-500">
                    {(TYPE_LABELS[doc.type]?.[lang] ?? doc.type) as string}
                  </span>
                  <span className="font-semibold text-zinc-900">{doc.code}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900">{doc.counterpart}</p>
                  <p className="text-xs text-zinc-500">{new Date(doc.date).toLocaleDateString(locale)}</p>
                </div>
                <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {(STATUS_LABELS[doc.status]?.[lang] ?? doc.status) as string}
                </span>
                <p className="text-sm font-semibold text-zinc-900 sm:text-right">
                  {doc.total === null ? "—" : formatMetric(doc.total, "currency", locale)}
                </p>
              </Link>
            ))}
            {snapshot.latestDocuments.length === 0 && (
              <p className="py-4 text-sm text-zinc-500">{text.noTransactions}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">{text.operations}</p>
              <h2 className="text-xl font-semibold text-zinc-900">{text.todo}</h2>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {snapshot.operationalTodo.map((task) => (
              <Link key={task.id} href={task.href} className="block rounded-2xl border border-zinc-100 p-4 hover:bg-zinc-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-zinc-900">
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
                    {formatMetric(task.count, "number", locale)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {lang === "fr"
                    ? task.description
                        .replace("Send reminders or close out quotes before validity lapses.", "Relancer ou cloturer les devis avant expiration.")
                        .replace("Confirm approved orders to release fulfillment tasks.", "Confirmer les commandes approuvees pour lancer la preparation.")
                        .replace("Follow up with suppliers on late inbound shipments.", "Relancer les fournisseurs sur les livraisons en retard.")
                    : task.description}
                </p>
              </Link>
            ))}
            </div>
          </div>
      </section>
    </div>
  );
}
