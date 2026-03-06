"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export function PurchasesReceiptsManager({ warehouses }: { warehouses: Warehouse[] }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

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

      if (!ordersRes.ok) throw new Error(ordersBody.error ?? "Failed to load purchase orders");
      if (!receiptsRes.ok) throw new Error(receiptsBody.error ?? "Failed to load receipts");

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
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, selectedOrderId]);

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
        throw new Error("At least one line quantity must be greater than zero");
      }

      const res = await fetch("/api/purchases/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create receipt");

      setStatus("Receipt created");
      setNotes("");
      setQuantities({});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create receipt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {status ? <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Create Goods Receipt</h2>
        <form onSubmit={createReceipt} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Select PO</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>PO-{order.poNumber} · {order.supplier?.name}</option>
              ))}
            </select>
            <select value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          </div>

          {selectedOrder ? (
            <div className="space-y-2">
              {selectedOrder.lines.map((line) => (
                <div key={line.id} className="grid gap-2 rounded-xl border border-zinc-100 p-3 md:grid-cols-[1fr_120px_120px] md:items-center">
                  <div className="text-sm text-zinc-700">{line.product?.sku} — {line.product?.name}</div>
                  <input type="number" step="0.01" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={quantities[line.id] ?? line.quantity} onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))} />
                  <div className="text-sm text-zinc-500">@ ${Number(line.unitPrice).toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Pick a purchase order to receive lines.</p>
          )}

          <button disabled={!selectedOrder || submitting} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            {submitting ? "Creating..." : "Create receipt"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Receipts</h2>
          <button type="button" onClick={loadData} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">Refresh</button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading receipts...</p>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="rounded-2xl border border-zinc-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs text-zinc-500">GR-{receipt.receiptNumber}</p>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">{receipt.status}</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="text-sm text-zinc-700"><span className="text-zinc-500">PO: </span>{receipt.purchaseOrder ? `PO-${receipt.purchaseOrder.poNumber}` : "—"}</p>
                  <p className="text-sm text-zinc-700 sm:text-right"><span className="text-zinc-500">Warehouse: </span>{receipt.warehouse?.name ?? "—"}</p>
                </div>
                <div className="mt-2 space-y-1 text-xs text-zinc-600">
                  {receipt.lines.map((line) => (
                    <div key={line.id}>{line.product?.name ?? "Product"} · Qty {line.quantity} @ ${Number(line.unitPrice).toFixed(2)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
