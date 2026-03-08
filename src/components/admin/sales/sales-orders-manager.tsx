"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

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
  DRAFT: "bg-slate-100 text-slate-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

export function SalesOrdersManager({
  clients,
  products,
  warehouses,
  canManageSales,
  lang,
  currencyCode,
}: SalesOrdersManagerProps) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    }),
    [lang],
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: PAGE_SIZE.toString() });
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
  }, [page, t.loadFailed]);

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
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">{t.draftOrder}</h2>
          <p className="text-sm text-zinc-500">{t.draftHelp}</p>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">{t.client}</label>
              <select
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
              <label className="text-sm font-medium text-zinc-700">{t.notes}</label>
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t.optional}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">{t.lines}</p>
              <button type="button" onClick={addLine} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                {t.addLine}
              </button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-zinc-200 p-4 md:grid-cols-6">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs uppercase tracking-wide text-zinc-500">{t.product}</label>
                  <select
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
                  <label className="text-xs uppercase tracking-wide text-zinc-500">{t.warehouse}</label>
                  <select
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
                  <label className="text-xs uppercase tracking-wide text-zinc-500">{t.qty}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={line.quantity}
                    onChange={(event) => updateLine(index, "quantity", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-zinc-500">{t.unitPrice}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={line.unitPrice}
                    onChange={(event) => updateLine(index, "unitPrice", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-zinc-500">{t.taxes}</label>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={line.taxes}
                    onChange={(event) => updateLine(index, "taxes", event.target.value)}
                    placeholder="20,5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-zinc-500">{t.description}</label>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={line.description}
                      onChange={(event) => updateLine(index, "description", event.target.value)}
                      placeholder={t.optional}
                    />
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(index)} className="text-xs text-zinc-500 hover:text-red-600">
                        {t.remove}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
            >
              {submitting ? t.saving : t.createOrder}
            </button>
            <button type="button" onClick={resetForm} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              {t.reset}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{t.orders}</h2>
            <p className="text-sm text-zinc-500">
              {t.showing} {Math.min(orders.length, PAGE_SIZE)} {t.of} {total} {lang === "fr" ? "commandes" : "orders"}
            </p>
          </div>
          <button type="button" onClick={loadOrders} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            {t.refresh}
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-zinc-100 p-4">
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-zinc-500">SO-{order.orderNumber}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[order.status] ?? "bg-zinc-100 text-zinc-700"}`}
                    >
                      {(STATUS_LABELS[order.status]?.[lang] ?? order.status) as string}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-zinc-700">
                      <span className="text-zinc-500">{t.client}: </span>
                      {order.client?.name ?? "—"}
                    </p>
                    <p className="text-sm text-zinc-700 sm:text-right">
                      <span className="text-zinc-500">{t.total}: </span>
                      {formatCurrency(Number(order.totalAmount ?? 0), locale, currencyCode)}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-600">
                    {order.lines.map((line) => (
                      <div key={line.id}>
                        {line.product?.name ?? line.productId} · {line.warehouse?.name ?? "—"} · {t.qty} {line.quantity}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {order.status === "DRAFT" && canManageSales && (
                      <button
                        className="rounded-md border border-emerald-200 px-2 py-1 text-emerald-700"
                        onClick={() => handleStatusChange(order.id, "APPROVED")}
                      >
                        {t.approve}
                      </button>
                    )}
                    {order.status === "APPROVED" && canManageSales && (
                      <button
                        className="rounded-md border border-blue-200 px-2 py-1 text-blue-700"
                        onClick={() => handleStatusChange(order.id, "CONFIRMED")}
                      >
                        {t.confirmShip}
                      </button>
                    )}
                    {order.status !== "REJECTED" && order.status !== "CONFIRMED" && (
                      <button
                        className="rounded-md border border-red-200 px-2 py-1 text-red-600"
                        onClick={() => handleStatusChange(order.id, "REJECTED")}
                      >
                        {t.reject}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>
            {t.page} {page} {t.of} {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40"
            >
              {t.previous}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40"
            >
              {t.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
