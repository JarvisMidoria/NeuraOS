"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type SupplierOption = { id: string; name: string };
type ProductOption = { id: string; sku: string; name: string; unitPrice: string };

type PurchaseOrder = {
  id: string;
  poNumber: number;
  status: string;
  expectedDate?: string | null;
  totalAmount: string;
  supplier: { id: string; name: string };
  lines: Array<{
    id: string;
    product?: { id: string; name: string; sku: string } | null;
    quantity: string;
    unitPrice: string;
  }>;
};

type FormLine = {
  productId: string;
  quantity: string;
  unitPrice: string;
  taxes: string;
};

const PAGE_SIZE = 10;

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

export function PurchasesOrdersManager({
  suppliers,
  products,
  canManagePurchasing,
  currencyCode,
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
  canManagePurchasing: boolean;
  currencyCode: string;
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplierId: suppliers[0]?.id ?? "",
    expectedDate: "",
    notes: "",
  });
  const [lines, setLines] = useState<FormLine[]>([
    { productId: products[0]?.id ?? "", quantity: "1", unitPrice: products[0]?.unitPrice ?? "0", taxes: "20" },
  ]);
  const locale = "en-US";

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/purchases/orders?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load purchase orders");
      setOrders(body.data ?? []);
      setTotal(body.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateLine = (index: number, key: keyof FormLine, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { productId: products[0]?.id ?? "", quantity: "1", unitPrice: products[0]?.unitPrice ?? "0", taxes: "20" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      const payload = {
        supplierId: form.supplierId,
        expectedDate: form.expectedDate || null,
        notes: form.notes || null,
        lines: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxes: line.taxes
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((rate) => ({ rate, label: `${rate}% VAT` })),
        })),
      };

      const res = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create purchase order");

      setStatus("Purchase order created");
      setForm({ supplierId: suppliers[0]?.id ?? "", expectedDate: "", notes: "" });
      setLines([{ productId: products[0]?.id ?? "", quantity: "1", unitPrice: products[0]?.unitPrice ?? "0", taxes: "20" }]);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase order");
    } finally {
      setSubmitting(false);
    }
  };

  const setOrderStatus = async (orderId: string, nextStatus: string) => {
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/purchases/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update purchase order");
      setStatus("Purchase order updated");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update purchase order");
    }
  };

  return (
    <div className="space-y-6">
      {status ? <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Create Purchase Order</h2>
        <form onSubmit={createOrder} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
            <input type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.expectedDate} onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))} />
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">Lines</p>
              <button type="button" onClick={addLine} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">+ Add line</button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-zinc-200 p-4 md:grid-cols-4">
                <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)}>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>
                  ))}
                </select>
                <input type="number" step="0.01" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
                <input type="number" step="0.01" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Unit price" value={line.unitPrice} onChange={(e) => updateLine(index, "unitPrice", e.target.value)} />
                <div className="flex items-center gap-2">
                  <input className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Taxes % (e.g. 20)" value={line.taxes} onChange={(e) => updateLine(index, "taxes", e.target.value)} />
                  {lines.length > 1 ? (
                    <button type="button" onClick={() => removeLine(index)} className="text-xs text-red-600">Remove</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <button disabled={!canManagePurchasing || submitting} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            {submitting ? "Creating..." : "Create PO"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Purchase Orders</h2>
          <button type="button" onClick={loadOrders} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">Refresh</button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading purchase orders...</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-zinc-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs text-zinc-500">PO-{order.poNumber}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGES[order.status] ?? "bg-zinc-100 text-zinc-700"}`}>{order.status}</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="text-sm text-zinc-700"><span className="text-zinc-500">Supplier: </span>{order.supplier?.name ?? "—"}</p>
                  <p className="text-sm text-zinc-700 sm:text-right"><span className="text-zinc-500">Total: </span>{formatCurrency(Number(order.totalAmount), locale, currencyCode)}</p>
                </div>
                <div className="mt-2 space-y-1 text-xs text-zinc-600">
                  {order.lines.map((line) => (
                    <div key={line.id}>{line.product?.name ?? "Product"} · Qty {line.quantity} @ {formatCurrency(Number(line.unitPrice), locale, currencyCode)}</div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {order.status === "DRAFT" ? (
                    <button className="rounded-md border border-zinc-300 px-2 py-1" onClick={() => setOrderStatus(order.id, "SENT")}>Mark sent</button>
                  ) : null}
                  {order.status === "SENT" ? (
                    <button className="rounded-md border border-blue-200 px-2 py-1 text-blue-700" onClick={() => setOrderStatus(order.id, "CONFIRMED")}>Confirm</button>
                  ) : null}
                  {(order.status === "DRAFT" || order.status === "SENT") ? (
                    <button className="rounded-md border border-red-200 px-2 py-1 text-red-600" onClick={() => setOrderStatus(order.id, "CANCELLED")}>Cancel</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
