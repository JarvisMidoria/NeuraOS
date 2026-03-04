import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDashboardSnapshot } from "@/lib/dashboard-service";

const currencyFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

function formatMetric(value: number, formatter: "currency" | "number" | "percent") {
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

export default async function AdminDashboard() {
  const session = await auth();
  const user = session?.user;

  if (!user?.companyId) {
    notFound();
  }

  if (!user.permissions?.includes("VIEW_DASHBOARD")) {
    notFound();
  }

  const snapshot = await getDashboardSnapshot(user.companyId);
  const maxMonthlyValue = Math.max(...snapshot.monthlySales.map((entry) => entry.total), 1);
  const recentLowStock = snapshot.lowStock.slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-50 px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900">Welcome back, {user.name ?? "Admin"}</h1>
        <p className="text-sm text-zinc-500">Company: {user.companyId}</p>
      </div>

      <section aria-label="Key metrics" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.kpis.map((kpi) => (
          <div key={kpi.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">{kpi.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
              {formatMetric(kpi.value, kpi.formatter)}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className={`flex items-center gap-1 font-medium ${TREND_COLOR[kpi.trend]}`}>
                <span aria-hidden>{TREND_SYMBOL[kpi.trend]}</span>
                {kpi.deltaPct.toFixed(1)}%
              </span>
              {kpi.helper && <span className="text-xs text-zinc-500">{kpi.helper}</span>}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3" aria-label="Sales trend and inventory">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">Revenue</p>
              <h2 className="text-xl font-semibold text-zinc-900">Trailing 6 months</h2>
            </div>
            <span className="text-xs text-zinc-500">Auto-refreshed {new Date(snapshot.timestamp).toLocaleString()}</span>
          </div>
          <div className="mt-6 flex items-end gap-4" role="figure" aria-label="Monthly revenue bar chart">
            {snapshot.monthlySales.map((entry) => {
              const percentage = Math.round((entry.total / maxMonthlyValue) * 100);
              return (
                <div key={entry.iso} className="flex flex-1 flex-col items-center gap-3">
                  <div className="flex h-48 w-full items-end rounded-xl bg-zinc-100 p-2">
                    <div
                      className="w-full rounded-lg bg-gradient-to-t from-emerald-500 to-emerald-400"
                      style={{ height: `${percentage || 4}%` }}
                      aria-label={`${entry.month} revenue ${currencyFormatter.format(entry.total)}`}
                    />
                  </div>
                  <div className="text-center text-sm text-zinc-500">
                    <p className="font-medium text-zinc-900">{entry.month}</p>
                    <p>{currencyFormatter.format(entry.total)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">Inventory</p>
              <h2 className="text-xl font-semibold text-zinc-900">Low stock alerts</h2>
            </div>
            <Link href="/admin/stock" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
              View stock
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {recentLowStock.length === 0 && (
              <p className="text-sm text-zinc-500">All tracked items are within thresholds.</p>
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
                      On hand <span className="font-semibold text-zinc-900">{numberFormatter.format(current)}</span>
                    </span>
                    <span className="text-zinc-500">
                      Threshold {numberFormatter.format(threshold)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${Math.min((current / Math.max(threshold, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-rose-600">
                    Suggested replenishment: {numberFormatter.format(Math.ceil(deficit))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3" aria-label="Documents and tasks">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">Latest</p>
              <h2 className="text-xl font-semibold text-zinc-900">Documents</h2>
            </div>
          </div>
          <div className="mt-4 divide-y divide-zinc-100">
            {snapshot.latestDocuments.map((doc) => (
              <Link
                key={`${doc.type}-${doc.id}`}
                href={doc.href}
                className="flex items-center gap-4 py-4 transition hover:bg-zinc-50"
              >
                <div className="flex min-w-[7rem] flex-col">
                  <span className="text-xs uppercase tracking-wide text-zinc-500">{doc.type}</span>
                  <span className="font-semibold text-zinc-900">{doc.code}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900">{doc.counterpart}</p>
                  <p className="text-xs text-zinc-500">{new Date(doc.date).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {doc.status}
                </span>
                <p className="w-32 text-right text-sm font-semibold text-zinc-900">
                  {doc.total === null ? "—" : currencyFormatter.format(doc.total)}
                </p>
              </Link>
            ))}
            {snapshot.latestDocuments.length === 0 && (
              <p className="py-4 text-sm text-zinc-500">No transactions recorded yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-zinc-500">Operations</p>
              <h2 className="text-xl font-semibold text-zinc-900">To-do</h2>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {snapshot.operationalTodo.map((task) => (
              <Link key={task.id} href={task.href} className="block rounded-2xl border border-zinc-100 p-4 hover:bg-zinc-50">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-zinc-900">{task.label}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      task.severity === "high"
                        ? "bg-rose-100 text-rose-600"
                        : task.severity === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {numberFormatter.format(task.count)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{task.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
