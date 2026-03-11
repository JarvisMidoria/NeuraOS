"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton, ActionLinkButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";
import { AdminInlineAlert } from "../admin-inline-alert";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  value: number;
  target: number;
};

type Payload = {
  data: {
    progress: { completed: number; total: number; percent: number };
    checklist: ChecklistItem[];
    subscription: {
      plan: string;
      status: string;
      limits: Record<string, number>;
    };
  };
};

function checklistHref(id: string) {
  switch (id) {
    case "users":
      return "/admin/settings";
    case "products":
      return "/admin/products";
    case "warehouses":
      return "/admin/warehouses";
    case "suppliers":
      return "/admin/suppliers";
    case "taxes":
    case "stockRules":
      return "/admin/settings";
    case "firstQuote":
      return "/admin/sales/quotes";
    case "firstPO":
      return "/admin/purchases/orders";
    default:
      return "/admin";
  }
}

export function OnboardingConsole({ lang }: { lang: "en" | "fr" }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const text = useMemo(
    () => ({
      title: lang === "fr" ? "Onboarding" : "Onboarding",
      subtitle:
        lang === "fr"
          ? "Checklist de mise en service pour activer ton tenant SaaS rapidement."
          : "Startup checklist to activate your tenant quickly.",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      progress: lang === "fr" ? "Progression" : "Progress",
      subscription: lang === "fr" ? "Abonnement" : "Subscription",
      limits: lang === "fr" ? "Limites du plan" : "Plan limits",
      loading: lang === "fr" ? "Chargement..." : "Loading...",
      loadingError: lang === "fr" ? "Impossible de charger les donnees." : "Failed to load data.",
      done: lang === "fr" ? "Termine" : "Done",
      pending: lang === "fr" ? "A faire" : "Pending",
      checklist: lang === "fr" ? "Checklist" : "Checklist",
      openModule: lang === "fr" ? "Ouvrir module" : "Open module",
    }),
    [lang],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/onboarding/status");
      if (!response.ok) {
        let message = text.loadingError;
        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          // Ignore JSON parsing errors and keep the default message.
        }
        setError(message);
        setPayload(null);
        return;
      }
      const json = (await response.json()) as Payload;
      setPayload(json.data);
    } catch {
      setError(text.loadingError);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [text.loadingError]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-[var(--admin-muted)]">{text.loading}</p>;
  }

  if (error || !payload) {
    return (
      <div className="space-y-3">
        <AdminInlineAlert tone="error">{error ?? text.loadingError}</AdminInlineAlert>
        <ActionButton onClick={load} icon="refresh" label={text.refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="liquid-surface rounded-2xl p-5">
        <AdminToolbar>
          <div>
            <h2 className="text-xl font-semibold text-[var(--admin-text)]">{text.title}</h2>
            <p className="text-sm text-[var(--admin-muted)]">{text.subtitle}</p>
          </div>
          <AdminToolbarGroup align="end">
            <ActionButton onClick={load} icon="refresh" label={text.refresh} />
          </AdminToolbarGroup>
        </AdminToolbar>

        <div className="mt-4">
          <p className="text-sm text-[var(--admin-muted)]">
            {text.progress}: {payload.progress.completed}/{payload.progress.total}
          </p>
          <div className="mt-2 h-2 rounded-full bg-[var(--admin-soft-bg)]">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${payload.progress.percent}%` }} />
          </div>
        </div>
      </section>

      <section className="liquid-surface rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-[var(--admin-text)]">{text.checklist}</h3>
        <div className="mt-3 space-y-2">
          {payload.checklist.map((item) => (
            <div key={item.id} className="liquid-surface flex items-center justify-between rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-[var(--admin-text)]">{item.label}</p>
                <p className="text-xs text-[var(--admin-muted)]">{item.value}/{item.target}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    item.done
                      ? "border-emerald-400/45 bg-emerald-500/15 text-[var(--admin-text)]"
                      : "border-amber-400/45 bg-amber-500/15 text-[var(--admin-text)]"
                  }`}
                >
                  {item.done ? text.done : text.pending}
                </span>
                <ActionLinkButton
                  href={checklistHref(item.id)}
                  icon="right"
                  label={text.openModule}
                  className="px-2.5 py-1 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="liquid-surface rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-[var(--admin-text)]">{text.subscription}</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">{payload.subscription.plan} · {payload.subscription.status}</p>
        <h4 className="mt-4 text-sm font-semibold text-[var(--admin-text)]">{text.limits}</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(payload.subscription.limits).map(([key, value]) => (
            <div key={key} className="liquid-surface rounded-lg px-3 py-2 text-sm text-[var(--admin-muted)]">
              <p className="uppercase text-xs tracking-wide text-[var(--admin-muted)]">{key}</p>
              <p className="font-semibold text-[var(--admin-text)]">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
