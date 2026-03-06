"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
    return <p className="text-sm text-zinc-500">{text.loading}</p>;
  }

  if (error || !payload) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-400">{error ?? text.loadingError}</p>
        <button onClick={load} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
          {text.refresh}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">{text.title}</h2>
            <p className="text-sm text-zinc-500">{text.subtitle}</p>
          </div>
          <button onClick={load} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
            {text.refresh}
          </button>
        </div>

        <div className="mt-4">
          <p className="text-sm text-zinc-600">
            {text.progress}: {payload.progress.completed}/{payload.progress.total}
          </p>
          <div className="mt-2 h-2 rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${payload.progress.percent}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Checklist</h3>
        <div className="mt-3 space-y-2">
          {payload.checklist.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-zinc-900">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.value}/{item.target}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {item.done ? text.done : text.pending}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">{text.subscription}</h3>
        <p className="mt-2 text-sm text-zinc-700">{payload.subscription.plan} · {payload.subscription.status}</p>
        <h4 className="mt-4 text-sm font-semibold text-zinc-900">{text.limits}</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(payload.subscription.limits).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-zinc-100 px-3 py-2 text-sm text-zinc-700">
              <p className="uppercase text-xs tracking-wide text-zinc-500">{key}</p>
              <p className="font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
