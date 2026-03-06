"use client";

import { useEffect, useState } from "react";

type AlertRow = {
  id: string;
  companyName: string;
  status: string;
  plan: string;
  billingEmail?: string | null;
  updatedAt: string;
};

type OperationRow = {
  id: string;
  action: string;
  companyName: string;
  createdAt: string;
};

export function MasterNotificationsConsole() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [ops, setOps] = useState<OperationRow[]>([]);

  useEffect(() => {
    const run = async () => {
      const [overviewRes, opsRes] = await Promise.all([
        fetch("/api/master/overview"),
        fetch("/api/master/operations"),
      ]);
      if (overviewRes.ok) {
        const body = (await overviewRes.json()) as { data: { alerts: AlertRow[] } };
        setAlerts(body.data.alerts ?? []);
      }
      if (opsRes.ok) {
        const body = (await opsRes.json()) as { data: Array<{ id: string; action: string; companyName: string; createdAt: string }> };
        setOps(body.data ?? []);
      }
    };
    run();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Master Notifications</h1>
        <p className="text-sm text-zinc-500">Billing and lifecycle alerts across all tenants.</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Critical billing alerts</h2>
        <div className="mt-3 space-y-2">
          {alerts.length === 0 && <p className="text-sm text-zinc-500">No billing alerts.</p>}
          {alerts.map((alert) => (
            <a key={alert.id} href="/master/clients" className="block rounded-xl border border-zinc-100 p-3 hover:bg-zinc-50">
              <p className="font-semibold text-zinc-900">{alert.companyName}</p>
              <p className="text-xs text-zinc-500">{alert.status} · {alert.plan} · {alert.billingEmail ?? "No billing email"}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Recent platform operations</h2>
        <div className="mt-3 space-y-2">
          {ops.length === 0 && <p className="text-sm text-zinc-500">No operations yet.</p>}
          {ops.map((op) => (
            <div key={op.id} className="rounded-xl border border-zinc-100 p-3">
              <p className="font-semibold text-zinc-900">{op.action}</p>
              <p className="text-xs text-zinc-500">{op.companyName} · {new Date(op.createdAt).toLocaleString("en-US")}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
