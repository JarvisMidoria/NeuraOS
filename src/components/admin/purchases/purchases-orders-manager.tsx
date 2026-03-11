"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { ActionButton, ActionLinkButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";
import { AdminModal } from "../admin-modal";

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
  DRAFT: "border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]",
  SENT: "border border-sky-400/45 bg-sky-500/15 text-[var(--admin-text)]",
  CONFIRMED: "border border-blue-400/45 bg-blue-500/15 text-[var(--admin-text)]",
  PARTIALLY_RECEIVED: "border border-amber-400/45 bg-amber-500/15 text-[var(--admin-text)]",
  RECEIVED: "border border-emerald-400/45 bg-emerald-500/15 text-[var(--admin-text)]",
  CANCELLED: "border border-rose-400/45 bg-rose-500/15 text-[var(--admin-text)]",
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
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showLines, setShowLines] = useState(true);

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

  const resetComposer = () => {
    setForm({ supplierId: suppliers[0]?.id ?? "", expectedDate: "", notes: "" });
    setLines([{ productId: products[0]?.id ?? "", quantity: "1", unitPrice: products[0]?.unitPrice ?? "0", taxes: "20" }]);
    setShowLines(true);
  };

  const openComposer = () => {
    resetComposer();
    setIsComposerOpen(true);
  };

  const closeComposer = () => {
    resetComposer();
    setIsComposerOpen(false);
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
      resetComposer();
      setIsComposerOpen(false);
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
      {status ? (
        <div className="liquid-surface rounded-xl border border-emerald-400/45 bg-emerald-500/10 px-4 py-2 text-sm text-[var(--admin-text)]">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="liquid-surface rounded-xl border border-rose-400/45 bg-rose-500/10 px-4 py-2 text-sm text-[var(--admin-text)]">
          {error}
        </div>
      ) : null}

      <div className="liquid-surface rounded-2xl p-6">
        <div className="mb-4">
          <AdminToolbar>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Purchase Orders</h2>
            <AdminToolbarGroup align="end">
              <ActionButton type="button" icon="plus" tone="primary" onClick={openComposer} label="Add PO" />
              <ActionButton type="button" icon="refresh" onClick={loadOrders} label="Refresh" />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">Loading purchase orders...</p>
        ) : (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">No purchase orders yet.</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="liquid-surface rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-[var(--admin-muted)]">PO-{order.poNumber}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGES[order.status] ?? "border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-[var(--admin-text)]">
                      <span className="text-[var(--admin-muted)]">Supplier: </span>
                      {order.supplier?.name ?? "—"}
                    </p>
                    <p className="text-sm text-[var(--admin-text)] sm:text-right">
                      <span className="text-[var(--admin-muted)]">Total: </span>
                      {formatCurrency(Number(order.totalAmount), locale, currencyCode)}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[var(--admin-muted)]">
                    {order.lines.map((line) => (
                      <div key={line.id}>
                        {line.product?.name ?? "Product"} · Qty {line.quantity} @{" "}
                        {formatCurrency(Number(line.unitPrice), locale, currencyCode)}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <ActionLinkButton
                      icon="download"
                      href={`/api/documents/purchase-orders/${order.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 text-xs"
                      label="PO PDF"
                    />
                    {order.status === "DRAFT" ? (
                      <ActionButton size="sm" icon="apply" onClick={() => setOrderStatus(order.id, "SENT")} label="Mark sent" />
                    ) : null}
                    {order.status === "SENT" ? (
                      <ActionButton size="sm" icon="right" onClick={() => setOrderStatus(order.id, "CONFIRMED")} label="Confirm" />
                    ) : null}
                    {order.status === "DRAFT" || order.status === "SENT" ? (
                      <ActionButton size="sm" tone="danger" icon="close" onClick={() => setOrderStatus(order.id, "CANCELLED")} label="Cancel" />
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--admin-muted)]">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <ActionButton size="sm" icon="left" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} label="Previous" />
            <ActionButton size="sm" icon="right" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} label="Next" />
          </div>
        </div>
      </div>

      <AdminModal open={isComposerOpen} onClose={closeComposer} title="Create Purchase Order">
        <form onSubmit={createOrder} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="admin-toolbar-control"
              value={form.supplierId}
              onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="admin-toolbar-control"
              value={form.expectedDate}
              onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))}
            />
            <input
              className="admin-toolbar-control"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--admin-muted)]">Lines</p>
              <div className="flex items-center gap-2">
                <ActionButton
                  type="button"
                  size="sm"
                  icon={showLines ? "close" : "plus"}
                  onClick={() => setShowLines((prev) => !prev)}
                  label={showLines ? "Hide lines" : "Show lines"}
                />
                {showLines ? <ActionButton type="button" size="sm" icon="plus" onClick={addLine} label="+ Add line" /> : null}
              </div>
            </div>
            {showLines
              ? lines.map((line, index) => (
                  <div key={index} className="liquid-surface grid gap-3 rounded-xl p-4 md:grid-cols-4">
                    <select
                      className="admin-toolbar-control"
                      value={line.productId}
                      onChange={(e) => updateLine(index, "productId", e.target.value)}
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      className="admin-toolbar-control"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="admin-toolbar-control"
                      placeholder="Unit price"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, "unitPrice", e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        className="admin-toolbar-control w-full"
                        placeholder="Taxes % (e.g. 20)"
                        value={line.taxes}
                        onChange={(e) => updateLine(index, "taxes", e.target.value)}
                      />
                      {lines.length > 1 ? (
                        <ActionButton type="button" size="sm" tone="danger" icon="delete" onClick={() => removeLine(index)} label="Remove" />
                      ) : null}
                    </div>
                  </div>
                ))
              : null}
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              type="submit"
              tone="primary"
              icon="save"
              disabled={!canManagePurchasing || submitting}
              label={submitting ? "Creating..." : "Create PO"}
            />
            <ActionButton type="button" icon="close" onClick={closeComposer} label="Cancel" />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
