"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";
import { AdminModal } from "../admin-modal";

type Warehouse = { id: string; name: string };

type PurchaseOrder = {
  id: string;
  poNumber: number;
  status: string;
  supplier: { id: string; name: string };
  lines: Array<{
    id: string;
    productId: string;
    quantity: string;
    unitPrice: string;
    product?: { id: string; name: string; sku: string } | null;
  }>;
};

type Receipt = {
  id: string;
  receiptNumber: number;
  status: string;
  purchaseOrder?: { id: string; poNumber: number; status: string } | null;
  warehouse?: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    product?: { id: string; name: string; sku: string } | null;
    quantity: string;
    unitPrice: string;
  }>;
  receivedDate: string;
};

const PAGE_SIZE = 10;
const STATUS_BADGES: Record<string, string> = {
  DRAFT: "border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]",
  CONFIRMED: "border border-blue-400/45 bg-blue-500/15 text-[var(--admin-text)]",
  CANCELLED: "border border-rose-400/45 bg-rose-500/15 text-[var(--admin-text)]",
};

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  DRAFT: { en: "Draft", fr: "Brouillon" },
  CONFIRMED: { en: "Confirmed", fr: "Confirmee" },
  CANCELLED: { en: "Cancelled", fr: "Annulee" },
};

export function PurchasesReceiptsManager({
  warehouses,
  currencyCode,
  lang,
}: {
  warehouses: Warehouse[];
  currencyCode: string;
  lang: "en" | "fr";
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [showLines, setShowLines] = useState(true);

  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const t = useMemo(
    () => ({
      loadOrdersFailed:
        lang === "fr" ? "Impossible de charger les commandes achat" : "Failed to load purchase orders",
      loadReceiptsFailed: lang === "fr" ? "Impossible de charger les receptions" : "Failed to load receipts",
      loadFailed: lang === "fr" ? "Impossible de charger les donnees" : "Failed to load data",
      lineQtyError:
        lang === "fr" ? "Au moins une ligne doit avoir une quantite > 0" : "At least one line quantity must be greater than zero",
      createFailed: lang === "fr" ? "Impossible de creer la reception" : "Failed to create receipt",
      created: lang === "fr" ? "Reception creee" : "Receipt created",
      title: lang === "fr" ? "Receptions" : "Receipts",
      addReceipt: lang === "fr" ? "Ajouter reception" : "Add receipt",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement des receptions..." : "Loading receipts...",
      empty: lang === "fr" ? "Aucune reception." : "No receipts yet.",
      po: lang === "fr" ? "BC" : "PO",
      warehouse: lang === "fr" ? "Entrepot" : "Warehouse",
      product: lang === "fr" ? "Produit" : "Product",
      qty: lang === "fr" ? "Qte" : "Qty",
      page: lang === "fr" ? "Page" : "Page",
      of: lang === "fr" ? "sur" : "of",
      previous: lang === "fr" ? "Precedent" : "Previous",
      next: lang === "fr" ? "Suivant" : "Next",
      createReceipt: lang === "fr" ? "Creer reception marchandise" : "Create Goods Receipt",
      selectPo: lang === "fr" ? "Selectionner BC" : "Select PO",
      notes: lang === "fr" ? "Notes" : "Notes",
      lines: lang === "fr" ? "Lignes" : "Lines",
      hideLines: lang === "fr" ? "Masquer lignes" : "Hide lines",
      showLines: lang === "fr" ? "Afficher lignes" : "Show lines",
      pickPo:
        lang === "fr"
          ? "Selectionnez une commande achat pour preparer la reception."
          : "Pick a purchase order to receive lines.",
      creating: lang === "fr" ? "Creation..." : "Creating...",
      cancel: lang === "fr" ? "Annuler" : "Cancel",
    }),
    [lang],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, receiptsRes] = await Promise.all([
        fetch("/api/purchases/orders?page=1&pageSize=50"),
        fetch(`/api/purchases/receipts?page=${page}&pageSize=${PAGE_SIZE}`),
      ]);
      const ordersBody = await ordersRes.json();
      const receiptsBody = await receiptsRes.json();

      if (!ordersRes.ok) throw new Error(ordersBody.error ?? t.loadOrdersFailed);
      if (!receiptsRes.ok) throw new Error(receiptsBody.error ?? t.loadReceiptsFailed);

      const openOrders = (ordersBody.data ?? []).filter((order: PurchaseOrder) =>
        ["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(order.status),
      );

      setOrders(openOrders);
      setReceipts(receiptsBody.data ?? []);
      setTotal(receiptsBody.total ?? 0);

      if (!selectedOrderId && openOrders.length) {
        setSelectedOrderId(openOrders[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [page, selectedOrderId, t.loadFailed, t.loadOrdersFailed, t.loadReceiptsFailed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId), [orders, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrder) return;
    setQuantities((prev) => {
      const next = { ...prev };
      selectedOrder.lines.forEach((line) => {
        if (next[line.id] === undefined) next[line.id] = line.quantity;
      });
      return next;
    });
  }, [selectedOrder]);

  const resetCreator = () => {
    setNotes("");
    setQuantities({});
    setShowLines(true);
  };

  const openCreator = () => {
    resetCreator();
    setIsCreatorOpen(true);
  };

  const closeCreator = () => {
    resetCreator();
    setIsCreatorOpen(false);
  };

  const createReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const payload = {
        purchaseOrderId: selectedOrder.id,
        warehouseId: selectedWarehouseId,
        notes: notes || null,
        lines: selectedOrder.lines
          .map((line) => ({
            purchaseOrderLineId: line.id,
            productId: line.productId,
            warehouseId: selectedWarehouseId,
            quantity: quantities[line.id] ?? line.quantity,
            unitPrice: line.unitPrice,
          }))
          .filter((line) => Number(line.quantity) > 0),
      };

      if (!payload.lines.length) {
        throw new Error(t.lineQtyError);
      }

      const res = await fetch("/api/purchases/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.createFailed);

      setStatus(t.created);
      resetCreator();
      setIsCreatorOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.createFailed);
    } finally {
      setSubmitting(false);
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
              <ActionButton type="button" icon="plus" tone="primary" onClick={openCreator} label={t.addReceipt} />
              <ActionButton type="button" icon="refresh" onClick={loadData} label={t.refresh} />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {receipts.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">{t.empty}</p>
            ) : (
              receipts.map((receipt) => (
                <div key={receipt.id} className="liquid-surface rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-[var(--admin-muted)]">GR-{receipt.receiptNumber}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGES[receipt.status] ?? "border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"}`}
                    >
                      {(STATUS_LABELS[receipt.status]?.[lang] ?? receipt.status) as string}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-[var(--admin-text)]">
                      <span className="text-[var(--admin-muted)]">{t.po}: </span>
                      {receipt.purchaseOrder ? `PO-${receipt.purchaseOrder.poNumber}` : "-"}
                    </p>
                    <p className="text-sm text-[var(--admin-text)] sm:text-right">
                      <span className="text-[var(--admin-muted)]">{t.warehouse}: </span>
                      {receipt.warehouse?.name ?? "-"}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[var(--admin-muted)]">
                    {receipt.lines.map((line) => (
                      <div key={line.id}>
                        {line.product?.name ?? t.product} · {t.qty} {line.quantity} @{" "}
                        {formatCurrency(Number(line.unitPrice), locale, currencyCode)}
                      </div>
                    ))}
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

      <AdminModal open={isCreatorOpen} onClose={closeCreator} title={t.createReceipt}>
        <form onSubmit={createReceipt} className="mt-1 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="admin-toolbar-control"
            >
              <option value="">{t.selectPo}</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  PO-{order.poNumber} · {order.supplier?.name}
                </option>
              ))}
            </select>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="admin-toolbar-control"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <input
              className="admin-toolbar-control"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.notes}
            />
          </div>

          {selectedOrder ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--admin-muted)]">{t.lines}</p>
                <ActionButton
                  type="button"
                  size="sm"
                  icon={showLines ? "close" : "plus"}
                  onClick={() => setShowLines((prev) => !prev)}
                  label={showLines ? t.hideLines : t.showLines}
                />
              </div>
              {showLines
                ? selectedOrder.lines.map((line) => (
                    <div key={line.id} className="liquid-surface grid gap-2 rounded-xl p-3 md:grid-cols-[1fr_120px_120px] md:items-center">
                      <div className="text-sm text-[var(--admin-text)]">
                        {line.product?.sku} — {line.product?.name}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        className="admin-toolbar-control"
                        value={quantities[line.id] ?? line.quantity}
                        onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))}
                      />
                      <div className="text-sm text-[var(--admin-muted)]">@ {formatCurrency(Number(line.unitPrice), locale, currencyCode)}</div>
                    </div>
                  ))
                : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--admin-muted)]">{t.pickPo}</p>
          )}

          <div className="flex items-center gap-2">
            <ActionButton
              type="submit"
              tone="primary"
              icon="save"
              disabled={!selectedOrder || submitting}
              label={submitting ? t.creating : t.createReceipt}
            />
            <ActionButton type="button" icon="close" onClick={closeCreator} label={t.cancel} />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
