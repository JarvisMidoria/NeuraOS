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
}

async function submitMovement(endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "Stock operation failed");
  }
}

export function StockConsole({ warehouses, products, lowStock }: StockConsoleProps) {
  const [inboundForm, setInboundForm] = useState({ productId: "", warehouseId: "", quantity: "", reference: "" });
  const [outboundForm, setOutboundForm] = useState({ productId: "", warehouseId: "", quantity: "", reference: "" });
  const [adjustForm, setAdjustForm] = useState({ productId: "", warehouseId: "", quantity: "", reference: "" });
  const [transferForm, setTransferForm] = useState({ productId: "", fromWarehouseId: "", toWarehouseId: "", quantity: "", reference: "" });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lowStockItems, setLowStockItems] = useState(lowStock);
  const [refreshing, setRefreshing] = useState(false);

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
      await submitMovement(endpoint, payload);
      setStatus("Stock updated. Refresh page to see the latest balances.");
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stock operation failed");
    }
  };

  const refreshLowStock = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/stock/low");
      if (!response.ok) {
        throw new Error("Failed to load low stock items");
      }
      const payload = await response.json();
      setLowStockItems(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load low stock items");
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
          <h2 className="text-lg font-semibold text-zinc-900">Inbound Stock</h2>
          <p className="mb-4 text-sm text-zinc-500">Add stock into a warehouse from purchasing or returns.</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(event, "/api/stock/in", {
                productId: inboundForm.productId,
                warehouseId: inboundForm.warehouseId,
                quantity: inboundForm.quantity,
                reference: inboundForm.reference || null,
              }, () => setInboundForm({ productId: "", warehouseId: "", quantity: "", reference: "" }))
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={inboundForm.productId}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">Select product</option>
              {productOptions}
            </select>
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={inboundForm.warehouseId}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
            >
              <option value="">Select warehouse</option>
              {warehouseOptions}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Quantity"
              value={inboundForm.quantity}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, quantity: event.target.value }))}
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Reference (optional)"
              value={inboundForm.reference}
              onChange={(event) => setInboundForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Record inbound</button>
          </form>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Outbound Stock</h2>
          <p className="mb-4 text-sm text-zinc-500">Deduct stock for shipments or consumption.</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(event, "/api/stock/out", {
                productId: outboundForm.productId,
                warehouseId: outboundForm.warehouseId,
                quantity: outboundForm.quantity,
                reference: outboundForm.reference || null,
              }, () => setOutboundForm({ productId: "", warehouseId: "", quantity: "", reference: "" }))
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={outboundForm.productId}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">Select product</option>
              {productOptions}
            </select>
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={outboundForm.warehouseId}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
            >
              <option value="">Select warehouse</option>
              {warehouseOptions}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Quantity"
              value={outboundForm.quantity}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, quantity: event.target.value }))}
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Reference (optional)"
              value={outboundForm.reference}
              onChange={(event) => setOutboundForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Record outbound</button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Stock Adjustment</h2>
          <p className="mb-4 text-sm text-zinc-500">Apply inventory corrections (+/-) for cycle counts.</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(event, "/api/stock/adjust", {
                productId: adjustForm.productId,
                warehouseId: adjustForm.warehouseId,
                quantity: adjustForm.quantity,
                reference: adjustForm.reference || null,
              }, () => setAdjustForm({ productId: "", warehouseId: "", quantity: "", reference: "" }))
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={adjustForm.productId}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">Select product</option>
              {productOptions}
            </select>
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={adjustForm.warehouseId}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
            >
              <option value="">Select warehouse</option>
              {warehouseOptions}
            </select>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Quantity (use negative for shrinkage)"
              value={adjustForm.quantity}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, quantity: event.target.value }))}
              required
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Reference (optional)"
              value={adjustForm.reference}
              onChange={(event) => setAdjustForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Record adjustment</button>
          </form>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Transfer Stock</h2>
          <p className="mb-4 text-sm text-zinc-500">Move stock between warehouses.</p>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submitHandler(event, "/api/stock/transfer", {
                productId: transferForm.productId,
                fromWarehouseId: transferForm.fromWarehouseId,
                toWarehouseId: transferForm.toWarehouseId,
                quantity: transferForm.quantity,
                reference: transferForm.reference || null,
              }, () =>
                setTransferForm({ productId: "", fromWarehouseId: "", toWarehouseId: "", quantity: "", reference: "" })
              )
            }
          >
            <select
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={transferForm.productId}
              onChange={(event) => setTransferForm((prev) => ({ ...prev, productId: event.target.value }))}
            >
              <option value="">Select product</option>
              {productOptions}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={transferForm.fromWarehouseId}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, fromWarehouseId: event.target.value }))}
              >
                <option value="">From warehouse</option>
                {warehouseOptions}
              </select>
              <select
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={transferForm.toWarehouseId}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, toWarehouseId: event.target.value }))}
              >
                <option value="">To warehouse</option>
                {warehouseOptions}
              </select>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Quantity"
              value={transferForm.quantity}
              onChange={(event) => setTransferForm((prev) => ({ ...prev, quantity: event.target.value }))}
            />
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Reference (optional)"
              value={transferForm.reference}
              onChange={(event) => setTransferForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Transfer stock</button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Low Stock Alerts</h2>
            <p className="text-sm text-zinc-500">Products below their defined thresholds.</p>
          </div>
          <button
            type="button"
            onClick={refreshLowStock}
            disabled={refreshing}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {lowStockItems.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 font-semibold text-red-600">{item.currentStock}</td>
                    <td className="px-3 py-2">{item.lowStockThreshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">All products are above their thresholds.</p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Stock by Product</h2>
            <p className="text-sm text-zinc-500">Current totals by warehouse (refresh page after posting movements).</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            Refresh page
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Warehouses</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.productId} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900">{item.name}</div>
                    {item.lowStockThreshold ? (
                      <p className="text-xs text-zinc-500">Threshold: {item.lowStockThreshold}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-semibold">{item.totalQuantity}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                      {item.warehouses.length ? (
                        item.warehouses.map((warehouse) => (
                          <span key={warehouse.warehouseId} className="rounded-full bg-zinc-100 px-2 py-0.5">
                            {warehouse.warehouseName}: {warehouse.quantity}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400">No movements yet</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
