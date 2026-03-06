"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Subscription = {
  id: string;
  plan: "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  seatLimit: number;
  billingEmail?: string | null;
  renewsAt?: string | null;
};

type Tenant = {
  id: string;
  name: string;
  domain?: string | null;
  createdAt: string;
  subscription?: Subscription | null;
  counts: {
    users: number;
    products: number;
    salesOrders: number;
    purchaseOrders: number;
  };
  adminUsers: Array<{ id: string; email: string; name: string }>;
};

type TenantPayload = {
  total: number;
  page: number;
  pageSize: number;
  data: Tenant[];
};

type Operation = {
  id: string;
  action: string;
  companyName: string;
  createdAt: string;
};

const PLANS: Array<Subscription["plan"]> = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];
const STATUSES: Array<Subscription["status"]> = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"];

export function SaasConsole() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);

  const [tenantForm, setTenantForm] = useState({
    companyName: "",
    domain: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    plan: "FREE",
    status: "TRIALING",
    seatLimit: 3,
    billingEmail: "",
    renewsAt: "",
  });

  const text = useMemo(
    () => ({
      title: "Master Client Manager",
      subtitle: "Manage subscribers, plans, lifecycle actions, and operations history.",
      createTenant: "Create tenant",
      save: "Save",
      create: "Create",
      search: "Search tenant...",
      refresh: "Refresh",
      company: "Company",
      admin: "Tenant admin",
      plan: "Plan",
      status: "Status",
      seats: "Seats",
      billingEmail: "Billing email",
      renewsAt: "Renews at",
      users: "Users",
      products: "Products",
      sales: "Sales",
      purchases: "Purchases",
      suspend: "Suspend",
      cancel: "Cancel",
      deleteLogical: "Delete (logical)",
      operations: "Recent operations",
    }),
    [],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("pageSize", "50");
      const [tenantsRes, opsRes] = await Promise.all([
        fetch(`/api/saas/tenants?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/master/operations"),
      ]);
      if (!tenantsRes.ok) {
        const payload = await tenantsRes.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to load tenants");
      }
      const payload = (await tenantsRes.json()) as TenantPayload;
      setItems(payload.data ?? []);
      if (opsRes.ok) {
        const opsPayload = (await opsRes.json()) as { data?: Operation[] };
        setOperations(Array.isArray(opsPayload.data) ? opsPayload.data : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const createTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setCreating(true);
      setError(null);
      const response = await fetch("/api/saas/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantForm),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to create tenant");
      }
      setTenantForm({
        companyName: "",
        domain: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        plan: "FREE",
        status: "TRIALING",
        seatLimit: 3,
        billingEmail: "",
        renewsAt: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  const updateSubscription = async (tenantId: string, next: Partial<Subscription>) => {
    try {
      setSavingId(tenantId);
      setError(null);
      const response = await fetch(`/api/saas/tenants/${tenantId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to update subscription");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setSavingId(null);
    }
  };

  const runLifecycleAction = async (tenantId: string, action: "suspend" | "cancel" | "deleteLogical") => {
    if (action === "suspend") {
      await updateSubscription(tenantId, { status: "PAST_DUE" });
      return;
    }
    if (action === "cancel") {
      await updateSubscription(tenantId, { status: "CANCELED" });
      return;
    }
    await updateSubscription(tenantId, { status: "CANCELED" });
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{text.createTenant}</h2>
        <form onSubmit={createTenant} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Company name" value={tenantForm.companyName} onChange={(e) => setTenantForm((p) => ({ ...p, companyName: e.target.value }))} required />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Domain" value={tenantForm.domain} onChange={(e) => setTenantForm((p) => ({ ...p, domain: e.target.value }))} />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Admin name" value={tenantForm.adminName} onChange={(e) => setTenantForm((p) => ({ ...p, adminName: e.target.value }))} required />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Admin email" type="email" value={tenantForm.adminEmail} onChange={(e) => setTenantForm((p) => ({ ...p, adminEmail: e.target.value }))} required />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Admin password" type="password" value={tenantForm.adminPassword} onChange={(e) => setTenantForm((p) => ({ ...p, adminPassword: e.target.value }))} required />
          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={tenantForm.plan} onChange={(e) => setTenantForm((p) => ({ ...p, plan: e.target.value }))}>
            {PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </select>
          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={tenantForm.status} onChange={(e) => setTenantForm((p) => ({ ...p, status: e.target.value }))}>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Seats" type="number" min={1} value={tenantForm.seatLimit} onChange={(e) => setTenantForm((p) => ({ ...p, seatLimit: Number(e.target.value) || 1 }))} />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Billing email" value={tenantForm.billingEmail} onChange={(e) => setTenantForm((p) => ({ ...p, billingEmail: e.target.value }))} />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" type="date" value={tenantForm.renewsAt} onChange={(e) => setTenantForm((p) => ({ ...p, renewsAt: e.target.value }))} />
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40" disabled={creating}>
            {creating ? "Creating..." : text.create}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <input
            className="w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder={text.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={load} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            {text.refresh}
          </button>
        </div>

        <div className="space-y-4">
          {loading && <p className="text-sm text-zinc-500">Loading...</p>}
          {!loading &&
            items.map((tenant) => (
              <article key={tenant.id} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-zinc-900">{tenant.name}</p>
                    <p className="text-xs text-zinc-500">{tenant.domain || tenant.id}</p>
                    <p className="text-xs text-zinc-500">
                      {text.admin}: {tenant.adminUsers[0]?.email ?? "-"}
                    </p>
                  </div>
                  <div className="grid min-w-[420px] flex-1 grid-cols-2 gap-2 md:grid-cols-5">
                    <select
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                      defaultValue={tenant.subscription?.plan ?? "FREE"}
                      onChange={(event) => updateSubscription(tenant.id, { plan: event.target.value as Subscription["plan"] })}
                    >
                      {PLANS.map((plan) => (
                        <option key={plan} value={plan}>{plan}</option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                      defaultValue={tenant.subscription?.status ?? "TRIALING"}
                      onChange={(event) => updateSubscription(tenant.id, { status: event.target.value as Subscription["status"] })}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <input
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                      type="number"
                      min={1}
                      defaultValue={tenant.subscription?.seatLimit ?? 3}
                      onBlur={(event) => updateSubscription(tenant.id, { seatLimit: Number(event.target.value) || 1 })}
                    />
                    <input
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                      defaultValue={tenant.subscription?.billingEmail ?? ""}
                      placeholder={text.billingEmail}
                      onBlur={(event) => updateSubscription(tenant.id, { billingEmail: event.target.value || null })}
                    />
                    <input
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                      type="date"
                      defaultValue={tenant.subscription?.renewsAt?.slice(0, 10) ?? ""}
                      onBlur={(event) => updateSubscription(tenant.id, { renewsAt: event.target.value || null })}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600 sm:grid-cols-4">
                  <span>{text.users}: {tenant.counts.users}</span>
                  <span>{text.products}: {tenant.counts.products}</span>
                  <span>{text.sales}: {tenant.counts.salesOrders}</span>
                  <span>{text.purchases}: {tenant.counts.purchaseOrders}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runLifecycleAction(tenant.id, "suspend")}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {text.suspend}
                  </button>
                  <button
                    type="button"
                    onClick={() => runLifecycleAction(tenant.id, "cancel")}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {text.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => runLifecycleAction(tenant.id, "deleteLogical")}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {text.deleteLogical}
                  </button>
                </div>

                {savingId === tenant.id && <p className="mt-2 text-xs text-zinc-500">{text.save}...</p>}
              </article>
            ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{text.operations}</h2>
        <div className="mt-3 space-y-2">
          {operations.length === 0 && <p className="text-sm text-zinc-500">No operations yet.</p>}
          {operations.map((op) => (
            <div key={op.id} className="rounded-xl border border-zinc-100 p-3">
              <p className="text-sm font-semibold text-zinc-900">{op.action}</p>
              <p className="text-xs text-zinc-500">
                {op.companyName} · {new Date(op.createdAt).toLocaleString("en-US")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
