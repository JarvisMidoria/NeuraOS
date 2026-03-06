"use client";

import { useState } from "react";

type Warehouse = {
  id: string;
  name: string;
};

type ProductStockSnapshot = {
  productId: string;
  sku: string;
  name: string;
  lowStockThreshold?: string | null;
  totalQuantity: string;
  warehouses: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: string;
  }>;
};

type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  currentStock: string;
  lowStockThreshold: string;
};

interface StockConsoleProps {
  warehouses: Warehouse[];
  products: ProductStockSnapshot[];
  lowStock: LowStockItem[];
  lang: "en" | "fr";
}

async function submitMovement(endpoint: string, payload: Record<string, unknown>, fallback: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? fallback);
  }
}

export function StockConsole({ warehouses, products, lowStock, lang }: StockConsoleProps) {
  const [inboundForm, setInboundForm] = useState({ productId: "", warehouseId: "", quantity: "", reference: "" });
  const [outboundForm, setOutboundForm] = useState({ productId: "", warehouseId: "", quantity: "", reference: "" });
  const [adjustForm, setAdjustForm] = useState({ productId: "", warehouseId: "", quantity: "", reference: "" });
  const [transferForm, setTransferForm] = useState({ productId: "", fromWarehouseId: "", toWarehouseId: "", quantity: "", reference: "" });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lowStockItems, setLowStockItems] = useState(lowStock);
  const [refreshing, setRefreshing] = useState(false);

  const t = {
    opFailed: lang === "fr" ? "Operation de stock echouee" : "Stock operation failed",
    updated:
      lang === "fr"
        ? "Stock mis a jour. Actualisez la page pour voir les soldes."
        : "Stock updated. Refresh page to see the latest balances.",
    loadLowStockFailed: lang === "fr" ? "Impossible de charger le stock bas" : "Failed to load low stock items",
    inbound: lang === "fr" ? "Entree de stock" : "Inbound Stock",
    inboundHelp:
      lang === "fr"
        ? "Ajoutez du stock dans un entrepot depuis les achats ou retours."
        : "Add stock into a warehouse from purchasing or returns.",
    outbound: lang === "fr" ? "Sortie de stock" : "Outbound Stock",
    outboundHelp:
      lang === "fr"
        ? "Deduisez du stock pour expeditions ou consommation."
        : "Deduct stock for shipments or consumption.",
    adjustment: lang === "fr" ? "Ajustement de stock" : "Stock Adjustment",
    adjustmentHelp:
      lang === "fr"
        ? "Appliquez des corrections (+/-) apres inventaire."
        : "Apply inventory corrections (+/-) for cycle counts.",
    transfer: lang === "fr" ? "Transfert de stock" : "Transfer Stock",
    transferHelp: lang === "fr" ? "Deplacez le stock entre entrepots." : "Move stock between warehouses.",
    selectProduct: lang === "fr" ? "Selectionner un produit" : "Select product",
    selectWarehouse: lang === "fr" ? "Selectionner un entrepot" : "Select warehouse",
    fromWarehouse: lang === "fr" ? "Depuis entrepot" : "From warehouse",
    toWarehouse: lang === "fr" ? "Vers entrepot" : "To warehouse",
    quantity: lang === "fr" ? "Quantite" : "Quantity",
    quantityAdjust:
      lang === "fr" ? "Quantite (negative pour perte)" : "Quantity (use negative for shrinkage)",
    reference: lang === "fr" ? "Reference (optionnelle)" : "Reference (optional)",
    recordInbound: lang === "fr" ? "Enregistrer entree" : "Record inbound",
    recordOutbound: lang === "fr" ? "Enregistrer sortie" : "Record outbound",
    recordAdjustment: lang === "fr" ? "Enregistrer ajustement" : "Record adjustment",
    transferStock: lang === "fr" ? "Transferer stock" : "Transfer stock",
    lowStockTitle: lang === "fr" ? "Alertes stock bas" : "Low Stock Alerts",
    lowStockHelp: lang === "fr" ? "Produits sous leur seuil defini." : "Products below their defined thresholds.",
    refreshing: lang === "fr" ? "Actualisation..." : "Refreshing...",
    refresh: lang === "fr" ? "Actualiser" : "Refresh",
    sku: "SKU",
    name: lang === "fr" ? "Nom" : "Name",
    stock: lang === "fr" ? "Stock" : "Stock",
    threshold: lang === "fr" ? "Seuil" : "Threshold",
    allAbove:
      lang === "fr" ? "Tous les produits sont au-dessus de leur seuil." : "All products are above their thresholds.",
    stockByProduct: lang === "fr" ? "Stock par produit" : "Stock by Product",
    stockByProductHelp:
      lang === "fr"
        ? "Totaux actuels par entrepot (actualisez apres mouvements)."
        : "Current totals by warehouse (refresh page after posting movements).",
    refreshPage: lang === "fr" ? "Actualiser la page" : "Refresh page",
    product: lang === "fr" ? "Produit" : "Product",
    total: lang === "fr" ? "Total" : "Total",
    warehouses: lang === "fr" ? "Entrepots" : "Warehouses",
    noMovements: lang === "fr" ? "Aucun mouvement" : "No movements yet",
  };

  const submitHandler = async (
    event: React.FormEvent<HTMLFormElement>,
    endpoint: string,
    payload: Record<string, unknown>,
    reset: () => void,
  ) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    try {
      await submitMovement(endpoint, payload, t.opFailed);
      setStatus(t.updated);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.opFailed);
    }
  };

  const refreshLowStock = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/stock/low");
      if (!response.ok) {
        throw new Error(t.loadLowStockFailed);
      }
      const payload = await response.json();
      setLowStockItems(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadLowStockFailed);
    } finally {
      setRefreshing(false);
    }
  };

  const productOptions = products.map((product) => (
    <option key={product.productId} value={product.productId}>
      {product.sku} • {product.name}
    </option>
  ));

  const warehouseOptions = warehouses.map((warehouse) => (
    <option key={warehouse.id} value={warehouse.id}>
      {warehouse.name}
    </option>
  ));

  return (
    <div className="space-y-6">
      {status && <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{status}</div>}
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{t.inbound}</h2>
          <p className="mb-4 text-sm text-zinc-500">{t.inboundHelp}</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(
                event,
                "/api/stock/in",
                {
                  productId: inboundForm.productId,
                  warehouseId: inboundForm.warehouseId,
                  quantity: inboundForm.quantity,
                  reference: inboundForm.reference || null,
                },
                () => setInboundForm({ productId: "", warehouseId: "", quantity: "", reference: "" }),
              )
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={inboundForm.productId}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">{t.selectProduct}</option>
              {productOptions}
            </select>
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={inboundForm.warehouseId}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
            >
              <option value="">{t.selectWarehouse}</option>
              {warehouseOptions}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.quantity}
              value={inboundForm.quantity}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, quantity: event.target.value }))}
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.reference}
              value={inboundForm.reference}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{t.recordInbound}</button>
          </form>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{t.outbound}</h2>
          <p className="mb-4 text-sm text-zinc-500">{t.outboundHelp}</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(
                event,
                "/api/stock/out",
                {
                  productId: outboundForm.productId,
                  warehouseId: outboundForm.warehouseId,
                  quantity: outboundForm.quantity,
                  reference: outboundForm.reference || null,
                },
                () => setOutboundForm({ productId: "", warehouseId: "", quantity: "", reference: "" }),
              )
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={outboundForm.productId}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">{t.selectProduct}</option>
              {productOptions}
            </select>
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={outboundForm.warehouseId}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
            >
              <option value="">{t.selectWarehouse}</option>
              {warehouseOptions}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.quantity}
              value={outboundForm.quantity}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, quantity: event.target.value }))}
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.reference}
              value={outboundForm.reference}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{t.recordOutbound}</button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{t.adjustment}</h2>
          <p className="mb-4 text-sm text-zinc-500">{t.adjustmentHelp}</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(
                event,
                "/api/stock/adjust",
                {
                  productId: adjustForm.productId,
                  warehouseId: adjustForm.warehouseId,
                  quantity: adjustForm.quantity,
                  reference: adjustForm.reference || null,
                },
                () => setAdjustForm({ productId: "", warehouseId: "", quantity: "", reference: "" }),
              )
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={adjustForm.productId}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">{t.selectProduct}</option>
              {productOptions}
            </select>
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={adjustForm.warehouseId}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
            >
              <option value="">{t.selectWarehouse}</option>
              {warehouseOptions}
            </select>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.quantityAdjust}
              value={adjustForm.quantity}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, quantity: event.target.value }))}
              required
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.reference}
              value={adjustForm.reference}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{t.recordAdjustment}</button>
          </form>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{t.transfer}</h2>
          <p className="mb-4 text-sm text-zinc-500">{t.transferHelp}</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(
                event,
                "/api/stock/transfer",
                {
                  productId: transferForm.productId,
                  fromWarehouseId: transferForm.fromWarehouseId,
                  toWarehouseId: transferForm.toWarehouseId,
                  quantity: transferForm.quantity,
                  reference: transferForm.reference || null,
                },
                () =>
                  setTransferForm({ productId: "", fromWarehouseId: "", toWarehouseId: "", quantity: "", reference: "" }),
              )
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={transferForm.productId}
              onChange={(event) => setTransferForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">{t.selectProduct}</option>
              {productOptions}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={transferForm.fromWarehouseId}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, fromWarehouseId: event.target.value }))}
              >
                <option value="">{t.fromWarehouse}</option>
                {warehouseOptions}
              </select>
              <select
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={transferForm.toWarehouseId}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, toWarehouseId: event.target.value }))}
              >
                <option value="">{t.toWarehouse}</option>
                {warehouseOptions}
              </select>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.quantity}
              value={transferForm.quantity}
              onChange={(event) => setTransferForm((prev) => ({ ...prev, quantity: event.target.value }))}
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder={t.reference}
              value={transferForm.reference}
              onChange={(event) => setTransferForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{t.transferStock}</button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{t.lowStockTitle}</h2>
            <p className="text-sm text-zinc-500">{t.lowStockHelp}</p>
          </div>
          <button
            type="button"
            onClick={refreshLowStock}
            disabled={refreshing}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            {refreshing ? t.refreshing : t.refresh}
          </button>
        </div>
        {lowStockItems.length ? (
          <div className="space-y-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-100 p-4">
                <p className="font-mono text-xs text-zinc-500">{item.sku}</p>
                <p className="mt-1 text-base font-semibold text-zinc-900">{item.name}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-1">
                    {t.stock}: <span className="font-semibold text-red-600">{item.currentStock}</span>
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1">
                    {t.threshold}: {item.lowStockThreshold}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{t.allAbove}</p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{t.stockByProduct}</h2>
            <p className="text-sm text-zinc-500">{t.stockByProductHelp}</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {t.refreshPage}
          </button>
        </div>
        <div className="space-y-3">
          {products.map((item) => (
            <div key={item.productId} className="rounded-2xl border border-zinc-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-zinc-500">{item.sku}</p>
                  <p className="mt-1 text-base font-semibold text-zinc-900">{item.name}</p>
                  {item.lowStockThreshold ? (
                    <p className="text-xs text-zinc-500">
                      {t.threshold}: {item.lowStockThreshold}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold">
                  {t.total}: {item.totalQuantity}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
                {item.warehouses.length ? (
                  item.warehouses.map((warehouse) => (
                    <span key={warehouse.warehouseId} className="rounded-full bg-zinc-100 px-2 py-0.5">
                      {warehouse.warehouseName}: {warehouse.quantity}
                    </span>
                  ))
                ) : (
                  <span className="text-zinc-400">{t.noMovements}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
