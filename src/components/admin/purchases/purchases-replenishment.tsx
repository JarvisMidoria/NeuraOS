"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "../action-button";

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
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Low Stock Suggestions</h2>
        <ActionButton type="button" icon="refresh" onClick={load} label="Refresh" />
      </div>

      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading suggestions...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No replenishment action required.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const current = Number(item.currentStock);
            const threshold = Number(item.lowStockThreshold);
            const suggested = Math.max(Math.ceil(threshold - current), 0);
            return (
              <div key={item.id} className="rounded-2xl border border-zinc-100 p-4">
                <p className="font-mono text-xs text-zinc-500">{item.sku}</p>
                <p className="mt-1 text-base font-semibold text-zinc-900">{item.name}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-1">Current: {item.currentStock}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1">Threshold: {item.lowStockThreshold}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">Suggested buy: {suggested}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
