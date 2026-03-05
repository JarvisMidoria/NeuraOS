"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export function SalesOrdersManager({
  clients,
  products,
  warehouses,
  canManageSales,
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

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: PAGE_SIZE.toString() });
      const response = await fetch(`/api/sales/orders?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load orders");
      }
      const payload = await response.json();
      setOrders(payload.data ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders");
    } finally {
      setLoading(false);
    }
  }, [page]);

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
            .map((rate) => ({ rate, label: `${rate}% TVA` })),
        })),
      };

      const response = await fetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Failed to create order");
      }

      resetForm();
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
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
        throw new Error(payload.error ?? "Failed to update order");
      }
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Draft Order</h2>
          <p className="text-sm text-zinc-500">Create a sales order manually for testing workflows.</p>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Client</label>
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
              <label className="text-sm font-medium text-zinc-700">Notes</label>
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">Lines</p>
              <button
                type="button"
                onClick={addLine}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                + Add line
              </button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-zinc-200 p-4 md:grid-cols-6">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs uppercase tracking-wide text-zinc-500">Product</label>
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
                  <label className="text-xs uppercase tracking-wide text-zinc-500">Warehouse</label>
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
                  <label className="text-xs uppercase tracking-wide text-zinc-500">Qty</label>
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
                  <label className="text-xs uppercase tracking-wide text-zinc-500">Unit Price</label>
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
                  <label className="text-xs uppercase tracking-wide text-zinc-500">Taxes %</label>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={line.taxes}
                    onChange={(event) => updateLine(index, "taxes", event.target.value)}
                    placeholder="20,5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-zinc-500">Description</label>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={line.description}
                      onChange={(event) => updateLine(index, "description", event.target.value)}
                      placeholder="Optional"
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="text-xs text-zinc-500 hover:text-red-600"
                      >
                        Remove
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
              {submitting ? "Saving..." : "Create Order"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Orders</h2>
            <p className="text-sm text-zinc-500">
              Showing {Math.min(orders.length, PAGE_SIZE)} of {total} orders
            </p>
          </div>
          <button
            type="button"
            onClick={loadOrders}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading orders...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2">Order #</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Lines</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-mono text-xs">SO-{order.orderNumber}</td>
                    <td className="px-3 py-2">{order.client?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold">${Number(order.totalAmount ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600">
                      {order.lines.map((line) => (
                        <div key={line.id}>
                          {line.product?.name ?? line.productId} · {line.warehouse?.name ?? "—"} · Qty {line.quantity}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {order.status === "DRAFT" && canManageSales && (
                          <button
                            className="rounded-md border border-emerald-200 px-2 py-1 text-emerald-700"
                            onClick={() => handleStatusChange(order.id, "APPROVED")}
                          >
                            Approve
                          </button>
                        )}
                        {order.status === "APPROVED" && canManageSales && (
                          <button
                            className="rounded-md border border-blue-200 px-2 py-1 text-blue-700"
                            onClick={() => handleStatusChange(order.id, "CONFIRMED")}
                          >
                            Confirm & Ship
                          </button>
                        )}
                        {order.status !== "REJECTED" && order.status !== "CONFIRMED" && (
                          <button
                            className="rounded-md border border-red-200 px-2 py-1 text-red-600"
                            onClick={() => handleStatusChange(order.id, "REJECTED")}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
