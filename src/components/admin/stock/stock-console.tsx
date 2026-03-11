"use client";

import { useState } from "react";
import { ActionButton, ActionLinkButton } from "../action-button";
import { AdminModal } from "../admin-modal";

type Warehouse = {
  id: string;
  name: string;
};

type ProductStockSnapshot = {
  productId: string;
  sku: string;
  name: string;
  unitOfMeasure: string;
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
  unitOfMeasure: string;
  currentStock: string;
  lowStockThreshold: string;
};

type MovementType = "inbound" | "outbound" | "adjustment" | "transfer";

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
  const [activeMovement, setActiveMovement] = useState<MovementType | null>(null);
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
    movementHub: lang === "fr" ? "Mouvements de stock" : "Stock Movements",
    movementHubHelp:
      lang === "fr"
        ? "Enregistrez rapidement une entree, sortie, correction ou transfert."
        : "Record inbound, outbound, adjustments, or transfers from one entry point.",
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
    total: lang === "fr" ? "Total" : "Total",
    noMovements: lang === "fr" ? "Aucun mouvement" : "No movements yet",
    openProducts: lang === "fr" ? "Ouvrir produits" : "Open products",
    openReplenishment: lang === "fr" ? "Ouvrir reappro" : "Open replenishment",
    openInbound: lang === "fr" ? "Ajouter entree" : "Add inbound",
    openOutbound: lang === "fr" ? "Ajouter sortie" : "Add outbound",
    openAdjustment: lang === "fr" ? "Ajuster stock" : "Adjust stock",
    openTransfer: lang === "fr" ? "Transferer" : "Transfer",
  };

  const formatUnit = (unit?: string) => {
    const normalized = String(unit ?? "").toUpperCase();
    switch (normalized) {
      case "M":
        return "m";
      case "KG":
        return "kg";
      case "L":
        return "L";
      case "EA":
      default:
        return lang === "fr" ? "unites" : "units";
    }
  };

  const withUnit = (value: string, unit?: string) => `${value} ${formatUnit(unit)}`;

  const closeMovementModal = () => setActiveMovement(null);

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
      closeMovementModal();
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

      <div className="liquid-surface rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.movementHub}</h2>
          <p className="text-sm text-[var(--admin-muted)]">{t.movementHubHelp}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ActionButton type="button" icon="plus" tone="primary" onClick={() => setActiveMovement("inbound")} label={t.openInbound} />
          <ActionButton type="button" icon="plus" onClick={() => setActiveMovement("outbound")} label={t.openOutbound} />
          <ActionButton type="button" icon="plus" onClick={() => setActiveMovement("adjustment")} label={t.openAdjustment} />
          <ActionButton type="button" icon="plus" onClick={() => setActiveMovement("transfer")} label={t.openTransfer} />
        </div>
      </div>

      <div className="liquid-surface rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.lowStockTitle}</h2>
            <p className="text-sm text-[var(--admin-muted)]">{t.lowStockHelp}</p>
          </div>
          <ActionButton
            type="button"
            icon="refresh"
            onClick={refreshLowStock}
            disabled={refreshing}
            label={refreshing ? t.refreshing : t.refresh}
          />
        </div>
        {lowStockItems.length ? (
          <div className="space-y-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="liquid-surface rounded-2xl p-4">
                <p className="font-mono text-xs text-[var(--admin-muted)]">{item.sku}</p>
                <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">{item.name}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2 py-1 text-[var(--admin-text)]">
                    {t.stock}: <span className="font-semibold text-red-600">{withUnit(item.currentStock, item.unitOfMeasure)}</span>
                  </span>
                  <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2 py-1 text-[var(--admin-text)]">
                    {t.threshold}: {withUnit(item.lowStockThreshold, item.unitOfMeasure)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionLinkButton href="/admin/products" icon="right" label={t.openProducts} className="px-2.5 py-1 text-xs" />
                  <ActionLinkButton
                    href="/admin/purchases/replenishment"
                    icon="right"
                    label={t.openReplenishment}
                    className="px-2.5 py-1 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--admin-muted)]">{t.allAbove}</p>
        )}
      </div>

      <div className="liquid-surface rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.stockByProduct}</h2>
            <p className="text-sm text-[var(--admin-muted)]">{t.stockByProductHelp}</p>
          </div>
          <ActionButton type="button" icon="refresh" onClick={() => window.location.reload()} label={t.refreshPage} />
        </div>
        <div className="space-y-3">
          {products.map((item) => (
            <div key={item.productId} className="liquid-surface rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-[var(--admin-muted)]">{item.sku}</p>
                  <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">{item.name}</p>
                  {item.lowStockThreshold ? (
                    <p className="text-xs text-[var(--admin-muted)]">
                      {t.threshold}: {withUnit(item.lowStockThreshold, item.unitOfMeasure)}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2 py-1 text-xs font-semibold text-[var(--admin-text)]">
                  {t.total}: {withUnit(item.totalQuantity, item.unitOfMeasure)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--admin-muted)]">
                {item.warehouses.length ? (
                  item.warehouses.map((warehouse) => (
                    <span
                      key={warehouse.warehouseId}
                      className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2 py-0.5 text-[var(--admin-text)]"
                    >
                      {warehouse.warehouseName}: {withUnit(warehouse.quantity, item.unitOfMeasure)}
                    </span>
                  ))
                ) : (
                  <span className="text-[var(--admin-muted)]">{t.noMovements}</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionLinkButton href="/admin/products" icon="right" label={t.openProducts} className="px-2.5 py-1 text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <AdminModal open={activeMovement === "inbound"} onClose={closeMovementModal} title={t.inbound}>
        <p className="mb-4 text-sm text-[var(--admin-muted)]">{t.inboundHelp}</p>
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
            className="admin-toolbar-control w-full"
            value={inboundForm.productId}
            onChange={(event) => setInboundForm((prev) => ({ ...prev, productId: event.target.value }))}
          >
            <option value="">{t.selectProduct}</option>
            {productOptions}
          </select>
          <select
            required
            className="admin-toolbar-control w-full"
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
            className="admin-toolbar-control w-full"
            placeholder={t.quantity}
            value={inboundForm.quantity}
            onChange={(event) => setInboundForm((prev) => ({ ...prev, quantity: event.target.value }))}
          />
          <input
            className="admin-toolbar-control w-full"
            placeholder={t.reference}
            value={inboundForm.reference}
            onChange={(event) => setInboundForm((prev) => ({ ...prev, reference: event.target.value }))}
          />
          <ActionButton type="submit" tone="primary" icon="save" className="w-full justify-center" label={t.recordInbound} />
        </form>
      </AdminModal>

      <AdminModal open={activeMovement === "outbound"} onClose={closeMovementModal} title={t.outbound}>
        <p className="mb-4 text-sm text-[var(--admin-muted)]">{t.outboundHelp}</p>
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
            className="admin-toolbar-control w-full"
            value={outboundForm.productId}
            onChange={(event) => setOutboundForm((prev) => ({ ...prev, productId: event.target.value }))}
          >
            <option value="">{t.selectProduct}</option>
            {productOptions}
          </select>
          <select
            required
            className="admin-toolbar-control w-full"
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
            className="admin-toolbar-control w-full"
            placeholder={t.quantity}
            value={outboundForm.quantity}
            onChange={(event) => setOutboundForm((prev) => ({ ...prev, quantity: event.target.value }))}
          />
          <input
            className="admin-toolbar-control w-full"
            placeholder={t.reference}
            value={outboundForm.reference}
            onChange={(event) => setOutboundForm((prev) => ({ ...prev, reference: event.target.value }))}
          />
          <ActionButton type="submit" tone="primary" icon="save" className="w-full justify-center" label={t.recordOutbound} />
        </form>
      </AdminModal>

      <AdminModal open={activeMovement === "adjustment"} onClose={closeMovementModal} title={t.adjustment}>
        <p className="mb-4 text-sm text-[var(--admin-muted)]">{t.adjustmentHelp}</p>
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
            className="admin-toolbar-control w-full"
            value={adjustForm.productId}
            onChange={(event) => setAdjustForm((prev) => ({ ...prev, productId: event.target.value }))}
          >
            <option value="">{t.selectProduct}</option>
            {productOptions}
          </select>
          <select
            required
            className="admin-toolbar-control w-full"
            value={adjustForm.warehouseId}
            onChange={(event) => setAdjustForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
          >
            <option value="">{t.selectWarehouse}</option>
            {warehouseOptions}
          </select>
          <input
            type="number"
            step="0.01"
            required
            className="admin-toolbar-control w-full"
            placeholder={t.quantityAdjust}
            value={adjustForm.quantity}
            onChange={(event) => setAdjustForm((prev) => ({ ...prev, quantity: event.target.value }))}
          />
          <input
            className="admin-toolbar-control w-full"
            placeholder={t.reference}
            value={adjustForm.reference}
            onChange={(event) => setAdjustForm((prev) => ({ ...prev, reference: event.target.value }))}
          />
          <ActionButton type="submit" tone="primary" icon="save" className="w-full justify-center" label={t.recordAdjustment} />
        </form>
      </AdminModal>

      <AdminModal open={activeMovement === "transfer"} onClose={closeMovementModal} title={t.transfer}>
        <p className="mb-4 text-sm text-[var(--admin-muted)]">{t.transferHelp}</p>
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
              () => setTransferForm({ productId: "", fromWarehouseId: "", toWarehouseId: "", quantity: "", reference: "" }),
            )
          }
        >
          <select
            required
            className="admin-toolbar-control w-full"
            value={transferForm.productId}
            onChange={(event) => setTransferForm((prev) => ({ ...prev, productId: event.target.value }))}
          >
            <option value="">{t.selectProduct}</option>
            {productOptions}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              required
              className="admin-toolbar-control"
              value={transferForm.fromWarehouseId}
              onChange={(event) => setTransferForm((prev) => ({ ...prev, fromWarehouseId: event.target.value }))}
            >
              <option value="">{t.fromWarehouse}</option>
              {warehouseOptions}
            </select>
            <select
              required
              className="admin-toolbar-control"
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
            className="admin-toolbar-control w-full"
            placeholder={t.quantity}
            value={transferForm.quantity}
            onChange={(event) => setTransferForm((prev) => ({ ...prev, quantity: event.target.value }))}
          />
          <input
            className="admin-toolbar-control w-full"
            placeholder={t.reference}
            value={transferForm.reference}
            onChange={(event) => setTransferForm((prev) => ({ ...prev, reference: event.target.value }))}
          />
          <ActionButton type="submit" tone="primary" icon="save" className="w-full justify-center" label={t.transferStock} />
        </form>
      </AdminModal>
    </div>
  );
}
