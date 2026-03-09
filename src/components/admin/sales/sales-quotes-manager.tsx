"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { ActionButton } from "../action-button";

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

type QuoteLineRecord = {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku: string } | null;
  warehouse?: { id: string; name: string } | null;
  description?: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

type QuoteRecord = {
  id: string;
  quoteNumber: number;
  status: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  validUntil?: string | null;
  notes?: string | null;
  client: ClientOption;
  convertedOrder?: { id: string; orderNumber: number; status: string } | null;
  lines: QuoteLineRecord[];
};

type QuoteLineForm = {
  productId: string;
  warehouseId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxes: string;
};

interface SalesQuotesManagerProps {
  clients: ClientOption[];
  products: ProductOption[];
  warehouses: WarehouseOption[];
  canManageSales: boolean;
  lang: "en" | "fr";
  currencyCode: string;
}

const PAGE_SIZE = 10;

const defaultLine = (products: ProductOption[], warehouses: WarehouseOption[]): QuoteLineForm => ({
  productId: products[0]?.id ?? "",
  warehouseId: warehouses[0]?.id ?? "",
  description: "",
  quantity: "1",
  unitPrice: products[0]?.unitPrice ?? "0",
  taxes: "20",
});

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  DRAFT: { en: "Draft", fr: "Brouillon" },
  SENT: { en: "Sent", fr: "Envoye" },
  APPROVED: { en: "Approved", fr: "Approuve" },
  REJECTED: { en: "Rejected", fr: "Rejete" },
  CONVERTED: { en: "Converted", fr: "Converti" },
  CONFIRMED: { en: "Confirmed", fr: "Confirme" },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CONVERTED: "bg-violet-100 text-violet-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
};

export function SalesQuotesManager({
  clients,
  products,
  warehouses,
  canManageSales,
  lang,
  currencyCode,
}: SalesQuotesManagerProps) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? "",
    validUntil: "",
    notes: "",
  });

  const [lines, setLines] = useState<QuoteLineForm[]>([defaultLine(products, warehouses)]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const t = useMemo(
    () => ({
      loadFailed: lang === "fr" ? "Impossible de charger les devis" : "Failed to load quotes",
      createFailed: lang === "fr" ? "Impossible de creer le devis" : "Failed to create quote",
      updateFailed: lang === "fr" ? "Impossible de mettre a jour le statut" : "Failed to update status",
      convertFailed: lang === "fr" ? "Conversion echouee" : "Conversion failed",
      createQuote: lang === "fr" ? "Creer un devis" : "Create Quote",
      createHelp:
        lang === "fr"
          ? "Saisissez un devis avec lignes, entrepots et taxes multiples."
          : "Capture a quote with flexible lines, warehouses, and multi-TVA entries.",
      client: lang === "fr" ? "Client" : "Client",
      validUntil: lang === "fr" ? "Valide jusqu'au" : "Valid Until",
      notes: lang === "fr" ? "Notes" : "Notes",
      optional: lang === "fr" ? "Optionnel" : "Optional",
      lines: lang === "fr" ? "Lignes" : "Lines",
      addLine: lang === "fr" ? "+ Ajouter ligne" : "+ Add line",
      product: lang === "fr" ? "Produit" : "Product",
      warehouse: lang === "fr" ? "Entrepot" : "Warehouse",
      notAssigned: lang === "fr" ? "Non assigne" : "Not assigned",
      qty: lang === "fr" ? "Qte" : "Qty",
      unitPrice: lang === "fr" ? "Prix unitaire" : "Unit Price",
      taxes: lang === "fr" ? "Taxes %" : "Taxes %",
      taxPlaceholder: lang === "fr" ? "ex: 20,5" : "e.g. 20,5",
      description: lang === "fr" ? "Description" : "Description",
      remove: lang === "fr" ? "Retirer" : "Remove",
      saving: lang === "fr" ? "Enregistrement..." : "Saving...",
      reset: lang === "fr" ? "Reinitialiser" : "Reset",
      quotes: lang === "fr" ? "Devis" : "Quotes",
      showing: lang === "fr" ? "Affichage" : "Showing",
      of: lang === "fr" ? "sur" : "of",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement des devis..." : "Loading quotes...",
      quoteNumber: lang === "fr" ? "Devis #" : "Quote #",
      status: lang === "fr" ? "Statut" : "Status",
      total: lang === "fr" ? "Total" : "Total",
      actions: lang === "fr" ? "Actions" : "Actions",
      markSent: lang === "fr" ? "Marquer envoye" : "Mark Sent",
      approve: lang === "fr" ? "Approuver" : "Approve",
      reject: lang === "fr" ? "Rejeter" : "Reject",
      convert: lang === "fr" ? "Convertir" : "Convert",
      page: lang === "fr" ? "Page" : "Page",
      previous: lang === "fr" ? "Precedent" : "Previous",
      next: lang === "fr" ? "Suivant" : "Next",
      qtyLong: lang === "fr" ? "Qte" : "Qty",
      tvaLabel: lang === "fr" ? "TVA" : "VAT",
    }),
    [lang],
  );

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: PAGE_SIZE.toString() });
      const response = await fetch(`/api/sales/quotes?${params.toString()}`);
      if (!response.ok) {
        throw new Error(t.loadFailed);
      }
      const payload = await response.json();
      setQuotes(payload.data ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [page, t.loadFailed]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const updateLine = (index: number, field: keyof QuoteLineForm, value: string) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, [field]: value } : line)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, defaultLine(products, warehouses)]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setForm({
      clientId: clients[0]?.id ?? "",
      validUntil: "",
      notes: "",
    });
    setLines([defaultLine(products, warehouses)]);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        clientId: form.clientId,
        validUntil: form.validUntil || null,
        notes: form.notes || null,
        lines: lines.map((line) => ({
          productId: line.productId,
          warehouseId: line.warehouseId || undefined,
          description: line.description || undefined,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxes: line.taxes
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((rate) => ({ rate, label: `${rate}% ${t.tvaLabel}` })),
        })),
      };

      const response = await fetch("/api/sales/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? t.createFailed);
      }

      resetForm();
      await loadQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.createFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (quoteId: string, status: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/sales/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t.updateFailed);
      }
      await loadQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.updateFailed);
    }
  };

  const handleConvert = async (quoteId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/sales/quotes/${quoteId}/convert`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t.convertFailed);
      }
      await loadQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.convertFailed);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">{t.createQuote}</h2>
          <p className="text-sm text-zinc-500">{t.createHelp}</p>
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">{t.validUntil}</label>
              <input
                type="date"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.validUntil}
                onChange={(event) => setForm((prev) => ({ ...prev, validUntil: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
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
              <ActionButton type="button" size="sm" icon="plus" onClick={addLine} label={t.addLine} />
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
                    <option value="">{t.notAssigned}</option>
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
                    placeholder={t.taxPlaceholder}
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
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ActionButton
              type="submit"
              tone="primary"
              icon="save"
              disabled={submitting}
              label={submitting ? t.saving : t.createQuote}
            />
            <ActionButton type="button" icon="close" onClick={resetForm} label={t.reset} />
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{t.quotes}</h2>
            <p className="text-sm text-zinc-500">
              {t.showing} {Math.min(quotes.length, PAGE_SIZE)} {t.of} {total} {lang === "fr" ? "devis" : "quotes"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ActionButton type="button" icon="refresh" onClick={loadQuotes} label={t.refresh} />
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {quotes.map((quote) => (
              <div key={quote.id} className="rounded-2xl border border-zinc-100 p-4">
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-zinc-500">Q-{quote.quoteNumber}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[quote.status] ?? "bg-zinc-100 text-zinc-700"}`}
                    >
                      {(STATUS_LABELS[quote.status]?.[lang] ?? quote.status) as string}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-zinc-700">
                      <span className="text-zinc-500">{t.client}: </span>
                      {quote.client?.name ?? "—"}
                    </p>
                    <p className="text-sm text-zinc-700 sm:text-right">
                      <span className="text-zinc-500">{t.total}: </span>
                      {formatCurrency(Number(quote.totalAmount), locale, currencyCode)}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {t.validUntil}: {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString(locale) : "—"}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-600">
                    {quote.lines.map((line) => (
                      <div key={line.id}>
                        {line.product?.name ?? line.productId} — {t.qtyLong} {line.quantity} @{" "}
                        {formatCurrency(Number(line.unitPrice), locale, currencyCode)}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {quote.status === "DRAFT" && (
                      <ActionButton size="sm" icon="apply" onClick={() => handleStatusChange(quote.id, "SENT")} label={t.markSent} />
                    )}
                    {quote.status !== "APPROVED" && quote.status !== "CONVERTED" && canManageSales && (
                      <ActionButton
                        size="sm"
                        tone="primary"
                        icon="apply"
                        onClick={() => handleStatusChange(quote.id, "APPROVED")}
                        label={t.approve}
                      />
                    )}
                    {quote.status !== "REJECTED" && quote.status !== "CONVERTED" && (
                      <ActionButton
                        size="sm"
                        tone="danger"
                        icon="close"
                        onClick={() => handleStatusChange(quote.id, "REJECTED")}
                        label={t.reject}
                      />
                    )}
                    {quote.status === "APPROVED" && canManageSales && (
                      <ActionButton size="sm" icon="right" onClick={() => handleConvert(quote.id)} label={t.convert} />
                    )}
                    {quote.convertedOrder && (
                      <span className="text-xs text-zinc-500">
                        SO-{quote.convertedOrder.orderNumber} ({(STATUS_LABELS[quote.convertedOrder.status]?.[lang] ?? quote.convertedOrder.status) as string})
                      </span>
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
    </div>
  );
}
