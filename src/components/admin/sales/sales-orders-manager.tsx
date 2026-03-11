"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { ActionButton, ActionLinkButton } from "../action-button";
import { useSearchParams } from "next/navigation";
import { AdminToolbar, AdminToolbarGroup, AdminToolbarSelect } from "../admin-toolbar";
import { AdminModal } from "../admin-modal";

type ClientOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unitPrice: string;
};

type WarehouseOption = {
  id: string;
  name: string;
};

type OrderRecord = {
  id: string;
  orderNumber: number;
  status: string;
  totalAmount: string;
  client: ClientOption;
  lines: Array<{
    id: string;
    productId: string;
    product?: { id: string; name: string; sku: string } | null;
    warehouse?: { id: string; name: string } | null;
    quantity: string;
    unitPrice: string;
  }>;
};

type OrderLineForm = {
  productId: string;
  warehouseId: string;
  quantity: string;
  unitPrice: string;
  taxes: string;
  description: string;
};

interface SalesOrdersManagerProps {
  clients: ClientOption[];
  products: ProductOption[];
  warehouses: WarehouseOption[];
  canManageSales: boolean;
  lang: "en" | "fr";
  currencyCode: string;
}

const PAGE_SIZE = 10;

const defaultLine = (products: ProductOption[], warehouses: WarehouseOption[]): OrderLineForm => ({
  productId: products[0]?.id ?? "",
  warehouseId: warehouses[0]?.id ?? "",
  quantity: "1",
  unitPrice: products[0]?.unitPrice ?? "0",
  taxes: "20",
  description: "",
});

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  DRAFT: { en: "Draft", fr: "Brouillon" },
  APPROVED: { en: "Approved", fr: "Approuve" },
  CONFIRMED: { en: "Confirmed", fr: "Confirme" },
  REJECTED: { en: "Rejected", fr: "Rejete" },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]",
  APPROVED: "border border-emerald-400/45 bg-emerald-500/15 text-[var(--admin-text)]",
  CONFIRMED: "border border-blue-400/45 bg-blue-500/15 text-[var(--admin-text)]",
  REJECTED: "border border-rose-400/45 bg-rose-500/15 text-[var(--admin-text)]",
};

const ORDER_FILTER_STATUSES = ["DRAFT", "APPROVED", "CONFIRMED", "REJECTED"] as const;

export function SalesOrdersManager({
  clients,
  products,
  warehouses,
  canManageSales,
  lang,
  currencyCode,
}: SalesOrdersManagerProps) {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showLines, setShowLines] = useState(true);

  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? "",
    notes: "",
  });

  const [lines, setLines] = useState<OrderLineForm[]>([defaultLine(products, warehouses)]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const t = useMemo(
    () => ({
      loadFailed: lang === "fr" ? "Impossible de charger les commandes" : "Failed to load orders",
      createFailed: lang === "fr" ? "Impossible de creer la commande" : "Failed to create order",
      updateFailed: lang === "fr" ? "Impossible de mettre a jour la commande" : "Failed to update order",
      draftOrder: lang === "fr" ? "Brouillon de commande" : "Draft Order",
      draftHelp:
        lang === "fr"
          ? "Creez une commande client manuellement pour tester le workflow."
          : "Create a sales order manually for testing workflows.",
      client: lang === "fr" ? "Client" : "Client",
      notes: lang === "fr" ? "Notes" : "Notes",
      optional: lang === "fr" ? "Optionnel" : "Optional",
      lines: lang === "fr" ? "Lignes" : "Lines",
      addLine: lang === "fr" ? "+ Ajouter ligne" : "+ Add line",
      product: lang === "fr" ? "Produit" : "Product",
      warehouse: lang === "fr" ? "Entrepot" : "Warehouse",
      qty: lang === "fr" ? "Qte" : "Qty",
      unitPrice: lang === "fr" ? "Prix unitaire" : "Unit Price",
      taxes: lang === "fr" ? "Taxes %" : "Taxes %",
      description: lang === "fr" ? "Description" : "Description",
      remove: lang === "fr" ? "Retirer" : "Remove",
      saving: lang === "fr" ? "Enregistrement..." : "Saving...",
      createOrder: lang === "fr" ? "Creer commande" : "Create Order",
      reset: lang === "fr" ? "Reinitialiser" : "Reset",
      orders: lang === "fr" ? "Commandes" : "Orders",
      showing: lang === "fr" ? "Affichage" : "Showing",
      of: lang === "fr" ? "sur" : "of",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement des commandes..." : "Loading orders...",
      noData: lang === "fr" ? "Aucune commande pour ces filtres." : "No orders for current filters.",
      orderNumber: lang === "fr" ? "Commande #" : "Order #",
      status: lang === "fr" ? "Statut" : "Status",
      total: lang === "fr" ? "Total" : "Total",
      actions: lang === "fr" ? "Actions" : "Actions",
      approve: lang === "fr" ? "Approuver" : "Approve",
      confirmShip: lang === "fr" ? "Confirmer & expedier" : "Confirm & Ship",
      reject: lang === "fr" ? "Rejeter" : "Reject",
      page: lang === "fr" ? "Page" : "Page",
      previous: lang === "fr" ? "Precedent" : "Previous",
      next: lang === "fr" ? "Suivant" : "Next",
      tvaLabel: lang === "fr" ? "TVA" : "VAT",
      openDeliveryNote: lang === "fr" ? "Bon livraison" : "Delivery note",
      allClients: lang === "fr" ? "Tous les clients" : "All clients",
      allStatuses: lang === "fr" ? "Tous les statuts" : "All statuses",
      addOrder: lang === "fr" ? "Ajouter commande" : "Add order",
      showLines: lang === "fr" ? "Afficher lignes" : "Show lines",
      hideLines: lang === "fr" ? "Masquer lignes" : "Hide lines",
    }),
    [lang],
  );

  useEffect(() => {
    const preselectClientId = searchParams.get("clientId");
    if (!preselectClientId) return;
    if (clients.some((client) => client.id === preselectClientId)) {
      setClientFilter(preselectClientId);
      setPage(1);
    }
  }, [clients, searchParams]);

  useEffect(() => {
    const preselectStatus = (searchParams.get("status") ?? "").toUpperCase();
    if (!preselectStatus) return;
    if (ORDER_FILTER_STATUSES.includes(preselectStatus as (typeof ORDER_FILTER_STATUSES)[number])) {
      setStatusFilter(preselectStatus);
      setPage(1);
    }
  }, [searchParams]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: PAGE_SIZE.toString() });
      if (clientFilter !== "all") {
        params.set("clientId", clientFilter);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const response = await fetch(`/api/sales/orders?${params.toString()}`);
      if (!response.ok) {
        throw new Error(t.loadFailed);
      }
      const payload = await response.json();
      setOrders(payload.data ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [clientFilter, page, statusFilter, t.loadFailed]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateLine = (index: number, field: keyof OrderLineForm, value: string) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, [field]: value } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, defaultLine(products, warehouses)]);
  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setForm({ clientId: clients[0]?.id ?? "", notes: "" });
    setLines([defaultLine(products, warehouses)]);
    setShowLines(true);
  };

  const openComposer = () => {
    resetForm();
    setIsComposerOpen(true);
  };

  const closeComposer = () => {
    resetForm();
    setIsComposerOpen(false);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        clientId: form.clientId,
        notes: form.notes || null,
        lines: lines.map((line) => ({
          productId: line.productId,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          description: line.description || undefined,
          taxes: line.taxes
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((rate) => ({ rate, label: `${rate}% ${t.tvaLabel}` })),
        })),
      };

      const response = await fetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? t.createFailed);
      }

      resetForm();
      setIsComposerOpen(false);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.createFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/sales/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t.updateFailed);
      }
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.updateFailed);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="liquid-surface rounded-xl border border-rose-400/45 bg-rose-500/10 px-4 py-2 text-sm text-[var(--admin-text)]">
          {error}
        </div>
      ) : null}

      <div className="liquid-surface rounded-2xl p-6">
        <div className="mb-4">
          <AdminToolbar>
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.orders}</h2>
              <p className="text-sm text-[var(--admin-muted)]">
                {t.showing} {Math.min(orders.length, PAGE_SIZE)} {t.of} {total} {lang === "fr" ? "commandes" : "orders"}
              </p>
            </div>
            <AdminToolbarGroup align="end">
              <ActionButton type="button" icon="plus" tone="primary" onClick={openComposer} label={t.addOrder} />
              <AdminToolbarSelect
                value={clientFilter}
                onChange={(event) => {
                  setClientFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t.allClients}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </AdminToolbarSelect>
              <AdminToolbarSelect
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t.allStatuses}</option>
                {ORDER_FILTER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {(STATUS_LABELS[status]?.[lang] ?? status) as string}
                  </option>
                ))}
              </AdminToolbarSelect>
              <ActionButton type="button" icon="refresh" onClick={loadOrders} label={t.refresh} />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">{t.noData}</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="liquid-surface rounded-2xl p-4">
                  <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-[var(--admin-muted)]">SO-{order.orderNumber}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[order.status] ?? "border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"}`}
                    >
                      {(STATUS_LABELS[order.status]?.[lang] ?? order.status) as string}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-[var(--admin-text)]">
                      <span className="text-[var(--admin-muted)]">{t.client}: </span>
                      {order.client?.name ?? "—"}
                    </p>
                    <p className="text-sm text-[var(--admin-text)] sm:text-right">
                      <span className="text-[var(--admin-muted)]">{t.total}: </span>
                      {formatCurrency(Number(order.totalAmount ?? 0), locale, currencyCode)}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-[var(--admin-muted)]">
                    {order.lines.map((line) => (
                      <div key={line.id}>
                        {line.product?.name ?? line.productId} · {line.warehouse?.name ?? "—"} · {t.qty} {line.quantity}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <ActionLinkButton
                      icon="download"
                      href={`/api/documents/sales-orders/${order.id}/delivery-note`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 text-xs"
                      label={t.openDeliveryNote}
                    />
                    {order.status === "DRAFT" && canManageSales && (
                      <ActionButton
                        size="sm"
                        tone="primary"
                        icon="apply"
                        onClick={() => handleStatusChange(order.id, "APPROVED")}
                        label={t.approve}
                      />
                    )}
                    {order.status === "APPROVED" && canManageSales && (
                      <ActionButton
                        size="sm"
                        icon="right"
                        onClick={() => handleStatusChange(order.id, "CONFIRMED")}
                        label={t.confirmShip}
                      />
                    )}
                    {order.status !== "REJECTED" && order.status !== "CONFIRMED" && (
                      <ActionButton
                        size="sm"
                        tone="danger"
                        icon="close"
                        onClick={() => handleStatusChange(order.id, "REJECTED")}
                        label={t.reject}
                      />
                    )}
                  </div>
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
              type="button"
              size="sm"
              icon="left"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              label={t.previous}
            />
            <ActionButton
              type="button"
              size="sm"
              icon="right"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              label={t.next}
            />
          </div>
        </div>
      </div>

      <AdminModal
        open={isComposerOpen}
        onClose={closeComposer}
        title={t.draftOrder}
        subtitle={t.draftHelp}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--admin-muted)]">{t.client}</label>
              <select
                className="admin-toolbar-control w-full"
                value={form.clientId}
                onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-[var(--admin-muted)]">{t.notes}</label>
              <input
                className="admin-toolbar-control w-full"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t.optional}
              />
            </div>
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
                  <div key={index} className="liquid-surface grid gap-3 rounded-xl p-4 md:grid-cols-6">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{t.product}</label>
                      <select
                        className="admin-toolbar-control w-full"
                        value={line.productId}
                        onChange={(event) => updateLine(index, "productId", event.target.value)}
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} — {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{t.warehouse}</label>
                      <select
                        className="admin-toolbar-control w-full"
                        value={line.warehouseId}
                        onChange={(event) => updateLine(index, "warehouseId", event.target.value)}
                      >
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{t.qty}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-toolbar-control w-full"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, "quantity", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{t.unitPrice}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-toolbar-control w-full"
                        value={line.unitPrice}
                        onChange={(event) => updateLine(index, "unitPrice", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{t.taxes}</label>
                      <input
                        className="admin-toolbar-control w-full"
                        value={line.taxes}
                        onChange={(event) => updateLine(index, "taxes", event.target.value)}
                        placeholder="20,5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">{t.description}</label>
                      <div className="flex items-center gap-2">
                        <input
                          className="admin-toolbar-control w-full"
                          value={line.description}
                          onChange={(event) => updateLine(index, "description", event.target.value)}
                          placeholder={t.optional}
                        />
                        {lines.length > 1 && (
                          <ActionButton
                            type="button"
                            size="sm"
                            tone="danger"
                            icon="delete"
                            onClick={() => removeLine(index)}
                            label={t.remove}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              : null}
          </div>

          <div className="flex items-center gap-3">
            <ActionButton
              type="submit"
              tone="primary"
              icon="save"
              disabled={submitting}
              label={submitting ? t.saving : t.createOrder}
            />
            <ActionButton type="button" icon="close" onClick={closeComposer} label={t.reset} />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
