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

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  DRAFT: { en: "Draft", fr: "Brouillon" },
  SENT: { en: "Sent", fr: "Envoyee" },
  CONFIRMED: { en: "Confirmed", fr: "Confirmee" },
  PARTIALLY_RECEIVED: { en: "Partially received", fr: "Partiellement recue" },
  RECEIVED: { en: "Received", fr: "Recue" },
  CANCELLED: { en: "Cancelled", fr: "Annulee" },
};

export function PurchasesOrdersManager({
  suppliers,
  products,
  canManagePurchasing,
  currencyCode,
  lang,
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
  canManagePurchasing: boolean;
  currencyCode: string;
  lang: "en" | "fr";
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
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const t = useMemo(
    () => ({
      loadFailed:
        lang === "fr" ? "Impossible de charger les commandes achat" : "Failed to load purchase orders",
      createFailed: lang === "fr" ? "Impossible de creer la commande achat" : "Failed to create purchase order",
      updateFailed:
        lang === "fr" ? "Impossible de mettre a jour la commande achat" : "Failed to update purchase order",
      created: lang === "fr" ? "Commande achat creee" : "Purchase order created",
      updated: lang === "fr" ? "Commande achat mise a jour" : "Purchase order updated",
      title: lang === "fr" ? "Commandes achat" : "Purchase Orders",
      addPo: lang === "fr" ? "Ajouter BC" : "Add PO",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement des commandes achat..." : "Loading purchase orders...",
      empty: lang === "fr" ? "Aucune commande achat." : "No purchase orders yet.",
      supplier: lang === "fr" ? "Fournisseur" : "Supplier",
      total: lang === "fr" ? "Total" : "Total",
      product: lang === "fr" ? "Produit" : "Product",
      qty: lang === "fr" ? "Qte" : "Qty",
      poPdf: lang === "fr" ? "PDF BC" : "PO PDF",
      markSent: lang === "fr" ? "Marquer envoye" : "Mark sent",
      confirm: lang === "fr" ? "Confirmer" : "Confirm",
      cancel: lang === "fr" ? "Annuler" : "Cancel",
      page: lang === "fr" ? "Page" : "Page",
      of: lang === "fr" ? "sur" : "of",
      previous: lang === "fr" ? "Precedent" : "Previous",
      next: lang === "fr" ? "Suivant" : "Next",
      createPo: lang === "fr" ? "Creer commande achat" : "Create Purchase Order",
      notes: lang === "fr" ? "Notes" : "Notes",
      lines: lang === "fr" ? "Lignes" : "Lines",
      hideLines: lang === "fr" ? "Masquer lignes" : "Hide lines",
      showLines: lang === "fr" ? "Afficher lignes" : "Show lines",
      addLine: lang === "fr" ? "+ Ajouter ligne" : "+ Add line",
      qtyPlaceholder: lang === "fr" ? "Qte" : "Qty",
      unitPricePlaceholder: lang === "fr" ? "Prix unitaire" : "Unit price",
      taxesPlaceholder: lang === "fr" ? "Taxes % (ex: 20)" : "Taxes % (e.g. 20)",
      remove: lang === "fr" ? "Retirer" : "Remove",
      creating: lang === "fr" ? "Creation..." : "Creating...",
      vatLabel: lang === "fr" ? "TVA" : "VAT",
    }),
    [lang],
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/purchases/orders?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.loadFailed);
      setOrders(body.data ?? []);
      setTotal(body.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [page, t.loadFailed]);

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
            .map((rate) => ({ rate, label: `${rate}% ${t.vatLabel}` })),
        })),
      };

      const res = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.createFailed);

      setStatus(t.created);
      resetComposer();
      setIsComposerOpen(false);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.createFailed);
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
      if (!res.ok) throw new Error(body.error ?? t.updateFailed);
      setStatus(t.updated);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.updateFailed);
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
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.title}</h2>
            <AdminToolbarGroup align="end">
              <ActionButton type="button" icon="plus" tone="primary" onClick={openComposer} label={t.addPo} />
              <ActionButton type="button" icon="refresh" onClick={loadOrders} label={t.refresh} />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">{t.empty}</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="liquid-surface rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-[var(--admin-muted)]">PO-{order.poNumber}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGES[order.status] ?? "border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"}`}
                    >
                      {(STATUS_LABELS[order.status]?.[lang] ?? order.status) as string}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-[var(--admin-text)]">
                      <span className="text-[var(--admin-muted)]">{t.supplier}: </span>
                      {order.supplier?.name ?? "—"}
                    </p>
                    <p className="text-sm text-[var(--admin-text)] sm:text-right">
                      <span className="text-[var(--admin-muted)]">{t.total}: </span>
                      {formatCurrency(Number(order.totalAmount), locale, currencyCode)}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[var(--admin-muted)]">
                    {order.lines.map((line) => (
                      <div key={line.id}>
                        {line.product?.name ?? t.product} · {t.qty} {line.quantity} @{" "}
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
                      label={t.poPdf}
                    />
                    {order.status === "DRAFT" ? (
                      <ActionButton size="sm" icon="apply" onClick={() => setOrderStatus(order.id, "SENT")} label={t.markSent} />
                    ) : null}
                    {order.status === "SENT" ? (
                      <ActionButton size="sm" icon="right" onClick={() => setOrderStatus(order.id, "CONFIRMED")} label={t.confirm} />
                    ) : null}
                    {order.status === "DRAFT" || order.status === "SENT" ? (
                      <ActionButton size="sm" tone="danger" icon="close" onClick={() => setOrderStatus(order.id, "CANCELLED")} label={t.cancel} />
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--admin-muted)]">
          <span>
            {t.page} {page} {t.of} {totalPages}
          </span>
          <div className="flex gap-2">
            <ActionButton
              size="sm"
              icon="left"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              label={t.previous}
            />
            <ActionButton
              size="sm"
              icon="right"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              label={t.next}
            />
          </div>
        </div>
      </div>

      <AdminModal open={isComposerOpen} onClose={closeComposer} title={t.createPo}>
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
              placeholder={t.notes}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--admin-muted)]">{t.lines}</p>
              <div className="flex items-center gap-2">
                <ActionButton
                  type="button"
                  size="sm"
                  icon={showLines ? "close" : "plus"}
                  onClick={() => setShowLines((prev) => !prev)}
                  label={showLines ? t.hideLines : t.showLines}
                />
                {showLines ? <ActionButton type="button" size="sm" icon="plus" onClick={addLine} label={t.addLine} /> : null}
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
                      placeholder={t.qtyPlaceholder}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="admin-toolbar-control"
                      placeholder={t.unitPricePlaceholder}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, "unitPrice", e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        className="admin-toolbar-control w-full"
                        placeholder={t.taxesPlaceholder}
                        value={line.taxes}
                        onChange={(e) => updateLine(index, "taxes", e.target.value)}
                      />
                      {lines.length > 1 ? (
                        <ActionButton type="button" size="sm" tone="danger" icon="delete" onClick={() => removeLine(index)} label={t.remove} />
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
              label={submitting ? t.creating : t.createPo}
            />
            <ActionButton type="button" icon="close" onClick={closeComposer} label={t.cancel} />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
