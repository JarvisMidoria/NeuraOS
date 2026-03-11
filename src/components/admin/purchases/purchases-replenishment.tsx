"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";

type Suggestion = {
  id: string;
  sku: string;
  name: string;
  currentStock: string;
  lowStockThreshold: string;
};

export function PurchasesReplenishment({ lang }: { lang: "en" | "fr" }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useMemo(
    () => ({
      loadFailed:
        lang === "fr"
          ? "Impossible de charger les suggestions de reapprovisionnement"
          : "Failed to load replenishment suggestions",
      title: lang === "fr" ? "Suggestions sous seuil" : "Low Stock Suggestions",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement des suggestions..." : "Loading suggestions...",
      empty: lang === "fr" ? "Aucune action de reapprovisionnement requise." : "No replenishment action required.",
      current: lang === "fr" ? "Stock actuel" : "Current",
      threshold: lang === "fr" ? "Seuil" : "Threshold",
      suggested: lang === "fr" ? "A acheter" : "Suggested buy",
    }),
    [lang],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchases/replenishment");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.loadFailed);
      setItems(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="liquid-surface rounded-2xl p-6">
      <div className="mb-4">
        <AdminToolbar>
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.title}</h2>
          <AdminToolbarGroup align="end">
            <ActionButton type="button" icon="refresh" onClick={load} label={t.refresh} />
          </AdminToolbarGroup>
        </AdminToolbar>
      </div>

      {error ? (
        <div className="liquid-surface rounded-xl border border-rose-400/45 bg-rose-500/10 px-4 py-2 text-sm text-[var(--admin-text)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--admin-muted)]">{t.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">{t.empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const current = Number(item.currentStock);
            const threshold = Number(item.lowStockThreshold);
            const suggested = Math.max(Math.ceil(threshold - current), 0);
            return (
              <div key={item.id} className="liquid-surface rounded-2xl p-4">
                <p className="font-mono text-xs text-[var(--admin-muted)]">{item.sku}</p>
                <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">{item.name}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2 py-1 text-[var(--admin-text)]">
                    {t.current}: {item.currentStock}
                  </span>
                  <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2 py-1 text-[var(--admin-text)]">
                    {t.threshold}: {item.lowStockThreshold}
                  </span>
                  <span className="rounded-full border border-amber-400/45 bg-amber-500/15 px-2 py-1 font-semibold text-[var(--admin-text)]">
                    {t.suggested}: {suggested}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
