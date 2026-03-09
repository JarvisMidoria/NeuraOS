"use client";

import { useMemo, useState } from "react";
import { ActionButton, ActionIcon } from "../action-button";

type BillingConsoleProps = {
  currentPlan: string;
  currentStatus: string;
  renewsAt?: string | null;
};

const PLANS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;

export function BillingConsole({ currentPlan, currentStatus, renewsAt }: BillingConsoleProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const text = useMemo(
    () => ({
      title: "Billing",
      subtitle: "Manage your subscription and payment settings.",
      currentPlan: "Current plan",
      currentStatus: "Status",
      renewsAt: "Renews at",
      openPortal: "Open billing portal",
      upgrade: "Choose plan",
    }),
    [],
  );

  const openCheckout = async (plan: string) => {
    try {
      setError(null);
      setLoadingPlan(plan);
      const response = await fetch("/api/saas/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error ?? "Unable to open checkout");
      }
      window.location.href = payload.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open checkout");
    } finally {
      setLoadingPlan(null);
    }
  };

  const openPortal = async () => {
    try {
      setError(null);
      setPortalLoading(true);
      const response = await fetch("/api/saas/billing/portal", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error ?? "Unable to open billing portal");
      }
      window.location.href = payload.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">{text.title}</h2>
        <p className="text-sm text-zinc-500">{text.subtitle}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-100 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{text.currentPlan}</p>
            <p className="font-semibold text-zinc-900">{currentPlan}</p>
          </div>
          <div className="rounded-lg border border-zinc-100 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{text.currentStatus}</p>
            <p className="font-semibold text-zinc-900">{currentStatus}</p>
          </div>
          <div className="rounded-lg border border-zinc-100 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{text.renewsAt}</p>
            <p className="font-semibold text-zinc-900">{renewsAt ? new Date(renewsAt).toLocaleDateString("en-US") : "-"}</p>
          </div>
        </div>

        <ActionButton
          onClick={openPortal}
          disabled={portalLoading}
          icon="right"
          className="mt-4 disabled:opacity-50"
          label={portalLoading ? "Loading..." : text.openPortal}
        />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">{text.upgrade}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <ActionButton
              key={plan}
              onClick={() => openCheckout(plan)}
              disabled={loadingPlan !== null}
              className="w-full justify-between rounded-lg px-4 py-3 text-left disabled:opacity-50"
              aria-label={`${text.upgrade} ${plan}`}
            >
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold text-[var(--admin-text)]">{plan}</span>
                <span className="mt-1 text-xs text-[var(--admin-muted)]">
                  {loadingPlan === plan ? "Opening checkout..." : "Start subscription"}
                </span>
              </span>
              <ActionIcon name={loadingPlan === plan ? "refresh" : "right"} className={loadingPlan === plan ? "animate-spin" : ""} />
            </ActionButton>
          ))}
        </div>
      </section>
    </div>
  );
}
