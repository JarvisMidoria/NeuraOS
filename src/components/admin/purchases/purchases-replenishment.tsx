"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";

type Suggestion = {
  id: string;
  sku: string;
  name: string;
  currentStock: string;
  lowStockThreshold: string;
};

export function PurchasesReplenishment() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchases/replenishment");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load replenishment suggestions");
      setItems(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load replenishment suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="liquid-surface rounded-2xl p-6">
      <div className="mb-4">
        <AdminToolbar>
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Low Stock Suggestions</h2>
          <AdminToolbarGroup align="end">
            <ActionButton type="button" icon="refresh" onClick={load} label="Refresh" />
          </AdminToolbarGroup>
        </AdminToolbar>
      </div>

      {error ? (
        <div className="liquid-surface rounded-xl border border-rose-400/45 bg-rose-500/10 px-4 py-2 text-sm text-[var(--admin-text)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--admin-muted)]">Loading suggestions...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">No replenishment action required.</p>
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
                    Current: {item.currentStock}
                  </span>
                  <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2 py-1 text-[var(--admin-text)]">
                    Threshold: {item.lowStockThreshold}
                  </span>
                  <span className="rounded-full border border-amber-400/45 bg-amber-500/15 px-2 py-1 font-semibold text-[var(--admin-text)]">
                    Suggested buy: {suggested}
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
