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

      <section className="liquid-surface rounded-2xl p-5">
        <h2 className="text-xl font-semibold text-[var(--admin-text)]">{text.title}</h2>
        <p className="text-sm text-[var(--admin-muted)]">{text.subtitle}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="liquid-surface rounded-lg px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{text.currentPlan}</p>
            <p className="font-semibold text-[var(--admin-text)]">{currentPlan}</p>
          </div>
          <div className="liquid-surface rounded-lg px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{text.currentStatus}</p>
            <p className="font-semibold text-[var(--admin-text)]">{currentStatus}</p>
          </div>
          <div className="liquid-surface rounded-lg px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{text.renewsAt}</p>
            <p className="font-semibold text-[var(--admin-text)]">{renewsAt ? new Date(renewsAt).toLocaleDateString("en-US") : "-"}</p>
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

      <section className="liquid-surface rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-[var(--admin-text)]">{text.upgrade}</h3>
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
