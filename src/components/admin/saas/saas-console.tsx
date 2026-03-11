"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminInlineAlert } from "../admin-inline-alert";

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
  llm?: {
    isEnabled: boolean;
    accessMode: "SHARED" | "BYOK";
  } | null;
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
      aiAccess: "AI access",
      aiOn: "AI ON",
      aiOff: "AI OFF",
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

  const toggleTenantAi = async (tenantId: string, enabled: boolean) => {
    try {
      setSavingId(tenantId);
      setError(null);
      const response = await fetch(`/api/saas/tenants/${tenantId}/ai`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to update AI access");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update AI access");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <section className="liquid-surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.createTenant}</h2>
        <form onSubmit={createTenant} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="admin-toolbar-control h-11 px-3 text-sm" placeholder="Company name" value={tenantForm.companyName} onChange={(e) => setTenantForm((p) => ({ ...p, companyName: e.target.value }))} required />
          <input className="admin-toolbar-control h-11 px-3 text-sm" placeholder="Domain" value={tenantForm.domain} onChange={(e) => setTenantForm((p) => ({ ...p, domain: e.target.value }))} />
          <input className="admin-toolbar-control h-11 px-3 text-sm" placeholder="Admin name" value={tenantForm.adminName} onChange={(e) => setTenantForm((p) => ({ ...p, adminName: e.target.value }))} required />
          <input className="admin-toolbar-control h-11 px-3 text-sm" placeholder="Admin email" type="email" value={tenantForm.adminEmail} onChange={(e) => setTenantForm((p) => ({ ...p, adminEmail: e.target.value }))} required />
          <input className="admin-toolbar-control h-11 px-3 text-sm" placeholder="Admin password" type="password" value={tenantForm.adminPassword} onChange={(e) => setTenantForm((p) => ({ ...p, adminPassword: e.target.value }))} required />
          <select className="admin-toolbar-control h-11 px-3 text-sm" value={tenantForm.plan} onChange={(e) => setTenantForm((p) => ({ ...p, plan: e.target.value }))}>
            {PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </select>
          <select className="admin-toolbar-control h-11 px-3 text-sm" value={tenantForm.status} onChange={(e) => setTenantForm((p) => ({ ...p, status: e.target.value }))}>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input className="admin-toolbar-control h-11 px-3 text-sm" placeholder="Seats" type="number" min={1} value={tenantForm.seatLimit} onChange={(e) => setTenantForm((p) => ({ ...p, seatLimit: Number(e.target.value) || 1 }))} />
          <input className="admin-toolbar-control h-11 px-3 text-sm" placeholder="Billing email" value={tenantForm.billingEmail} onChange={(e) => setTenantForm((p) => ({ ...p, billingEmail: e.target.value }))} />
          <input className="admin-toolbar-control h-11 px-3 text-sm" type="date" value={tenantForm.renewsAt} onChange={(e) => setTenantForm((p) => ({ ...p, renewsAt: e.target.value }))} />
          <ActionButton
            type="submit"
            tone="primary"
            icon="plus"
            disabled={creating}
            className="disabled:opacity-40"
            label={creating ? "Creating..." : text.create}
          />
        </form>
      </section>

      <section className="liquid-surface rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <input
            className="admin-toolbar-control h-11 w-full max-w-md px-3 text-sm"
            placeholder={text.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ActionButton
            onClick={load}
            icon="refresh"
            label={text.refresh}
            iconOnly
            size="icon"
            title={text.refresh}
          />
        </div>

        <div className="space-y-4">
          {loading && <p className="text-sm text-[var(--admin-muted)]">Loading...</p>}
          {!loading &&
            items.map((tenant) => (
              <article key={tenant.id} className="liquid-surface rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--admin-text)]">{tenant.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{tenant.domain || tenant.id}</p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {text.admin}: {tenant.adminUsers[0]?.email ?? "-"}
                    </p>
                  </div>
                  <div className="grid min-w-[420px] flex-1 grid-cols-2 gap-2 md:grid-cols-5">
                    <select
                      className="admin-toolbar-control h-10 px-2 text-xs"
                      defaultValue={tenant.subscription?.plan ?? "FREE"}
                      onChange={(event) => updateSubscription(tenant.id, { plan: event.target.value as Subscription["plan"] })}
                    >
                      {PLANS.map((plan) => (
                        <option key={plan} value={plan}>{plan}</option>
                      ))}
                    </select>
                    <select
                      className="admin-toolbar-control h-10 px-2 text-xs"
                      defaultValue={tenant.subscription?.status ?? "TRIALING"}
                      onChange={(event) => updateSubscription(tenant.id, { status: event.target.value as Subscription["status"] })}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <input
                      className="admin-toolbar-control h-10 px-2 text-xs"
                      type="number"
                      min={1}
                      defaultValue={tenant.subscription?.seatLimit ?? 3}
                      onBlur={(event) => updateSubscription(tenant.id, { seatLimit: Number(event.target.value) || 1 })}
                    />
                    <input
                      className="admin-toolbar-control h-10 px-2 text-xs"
                      defaultValue={tenant.subscription?.billingEmail ?? ""}
                      placeholder={text.billingEmail}
                      onBlur={(event) => updateSubscription(tenant.id, { billingEmail: event.target.value || null })}
                    />
                    <input
                      className="admin-toolbar-control h-10 px-2 text-xs"
                      type="date"
                      defaultValue={tenant.subscription?.renewsAt?.slice(0, 10) ?? ""}
                      onBlur={(event) => updateSubscription(tenant.id, { renewsAt: event.target.value || null })}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--admin-muted)] sm:grid-cols-4">
                  <span>{text.users}: {tenant.counts.users}</span>
                  <span>{text.products}: {tenant.counts.products}</span>
                  <span>{text.sales}: {tenant.counts.salesOrders}</span>
                  <span>{text.purchases}: {tenant.counts.purchaseOrders}</span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-[var(--admin-muted)]">{text.aiAccess}:</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-medium ${
                      tenant.llm?.isEnabled
                        ? "border-emerald-400/45 bg-emerald-500/15 text-[var(--admin-text)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                    }`}
                  >
                    {tenant.llm?.isEnabled ? text.aiOn : text.aiOff}
                  </span>
                  <ActionButton
                    type="button"
                    size="sm"
                    icon={tenant.llm?.isEnabled ? "close" : "apply"}
                    onClick={() => toggleTenantAi(tenant.id, !(tenant.llm?.isEnabled ?? false))}
                    label={tenant.llm?.isEnabled ? "Turn OFF" : "Turn ON"}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton type="button" size="sm" icon="close" onClick={() => runLifecycleAction(tenant.id, "suspend")} label={text.suspend} />
                  <ActionButton type="button" size="sm" icon="close" onClick={() => runLifecycleAction(tenant.id, "cancel")} label={text.cancel} />
                  <ActionButton
                    type="button"
                    size="sm"
                    tone="danger"
                    icon="delete"
                    onClick={() => runLifecycleAction(tenant.id, "deleteLogical")}
                    label={text.deleteLogical}
                  />
                </div>

                {savingId === tenant.id && <p className="mt-2 text-xs text-[var(--admin-muted)]">{text.save}...</p>}
              </article>
            ))}
        </div>
      </section>

      <section className="liquid-surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">{text.operations}</h2>
        <div className="mt-3 space-y-2">
          {operations.length === 0 && <p className="text-sm text-[var(--admin-muted)]">No operations yet.</p>}
          {operations.map((op) => (
            <div key={op.id} className="liquid-surface rounded-xl p-3">
              <p className="text-sm font-semibold text-[var(--admin-text)]">{op.action}</p>
              <p className="text-xs text-[var(--admin-muted)]">
                {op.companyName} · {new Date(op.createdAt).toLocaleString("en-US")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
