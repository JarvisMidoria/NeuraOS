"use client";

import { useEffect, useMemo, useState } from "react";

type OverviewPayload = {
  data: {
    subscriptions: {
      total: number;
      byPlan: Record<string, number>;
    };
    revenue: {
      range: string;
      amount: number;
      activeMrr: number;
    };
    alerts: Array<{
      id: string;
      companyId: string;
      companyName: string;
      status: string;
      plan: string;
      billingEmail?: string | null;
      updatedAt: string;
    }>;
    chart: Array<{ iso: string; month: string; amount: number }>;
    latestCustomers: Array<{
      id: string;
      companyName: string;
      plan: string;
      amount: number;
      createdAt: string;
    }>;
  };
};

const PLAN_FILTERS = ["ALL", "FREE", "STARTER", "GROWTH", "ENTERPRISE"] as const;
const REVENUE_FILTERS = ["day", "month", "3m", "6m", "year"] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function MasterDashboardConsole() {
  const [plan, setPlan] = useState<(typeof PLAN_FILTERS)[number]>("ALL");
  const [range, setRange] = useState<(typeof REVENUE_FILTERS)[number]>("month");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<OverviewPayload["data"] | null>(null);

  const maxChartAmount = useMemo(() => Math.max(...(payload?.chart.map((c) => c.amount) ?? [1]), 1), [payload]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/master/overview?plan=${plan}&range=${range}`);
        if (!res.ok) return;
        const json = (await res.json()) as OverviewPayload;
        if (mounted) setPayload(json.data);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [plan, range]);

  if (loading || !payload) {
    return <p className="text-sm text-zinc-500">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">NeuraOS Platform</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Master Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-md border border-zinc-300 px-2 py-1 text-sm" value={plan} onChange={(e) => setPlan(e.target.value as (typeof PLAN_FILTERS)[number])}>
              {PLAN_FILTERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="rounded-md border border-zinc-300 px-2 py-1 text-sm" value={range} onChange={(e) => setRange(e.target.value as (typeof REVENUE_FILTERS)[number])}>
              {REVENUE_FILTERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Subscriptions" value={String(payload.subscriptions.total)} helper="total active/trialing + others" />
        <Card title="Revenue (selected range)" value={money(payload.revenue.amount)} helper={`filter: ${payload.revenue.range}`} />
        <Card title="Current MRR" value={money(payload.revenue.activeMrr)} helper="active + trialing" />
        <Card title="PAST_DUE alerts" value={String(payload.alerts.length)} helper="requires follow-up" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">Subscription split by plan</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(payload.subscriptions.byPlan).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-zinc-100 p-3">
              <p className="text-xs text-zinc-500">{k}</p>
              <p className="text-2xl font-semibold text-zinc-900">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">Billing alerts</h2>
        <div className="mt-4 space-y-2">
          {payload.alerts.length === 0 && <p className="text-sm text-zinc-500">No unpaid alerts.</p>}
          {payload.alerts.map((alert) => (
            <a key={alert.id} href="/master/clients" className="block rounded-xl border border-zinc-100 p-3 hover:bg-zinc-50">
              <p className="text-sm font-semibold text-zinc-900">{alert.companyName}</p>
              <p className="text-xs text-zinc-500">{alert.status} · {alert.plan} · {alert.billingEmail ?? "No billing email"}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">SaaS revenue trailing 6 months</h2>
        <div className="mt-6 flex items-end gap-3">
          {payload.chart.map((entry) => {
            const height = Math.max(Math.round((entry.amount / maxChartAmount) * 100), 6);
            return (
              <div key={entry.iso} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end rounded-lg bg-zinc-100 p-2">
                  <div className="w-full rounded bg-gradient-to-t from-indigo-500 to-violet-500" style={{ height: `${height}%` }} />
                </div>
                <p className="text-xs text-zinc-500">{entry.month}</p>
                <p className="text-xs font-semibold text-zinc-900">{money(entry.amount)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">Latest subscribed customers</h2>
        <div className="mt-4 space-y-2">
          {payload.latestCustomers.map((item) => (
            <div key={item.id} className="grid rounded-xl border border-zinc-100 p-3 text-sm sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
              <p className="font-semibold text-zinc-900">{item.companyName}</p>
              <p className="text-zinc-500">{item.plan}</p>
              <p className="text-zinc-900">{money(item.amount)}</p>
              <p className="text-zinc-500">{new Date(item.createdAt).toLocaleDateString("en-US")}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{value}</p>
      <p className="mt-3 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}
