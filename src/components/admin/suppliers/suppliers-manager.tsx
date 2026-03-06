"use client";

import { useEffect, useState } from "react";

type Supplier = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", name: "", email: "", phone: "", address: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/suppliers");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load suppliers");
      setSuppliers(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => setForm({ id: "", name: "", email: "", phone: "", address: "" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const endpoint = form.id ? `/api/suppliers/${form.id}` : "/api/suppliers";
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save supplier");
      setStatus(form.id ? "Supplier updated" : "Supplier created");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save supplier");
    }
  };

  const remove = async (supplier: Supplier) => {
    if (!window.confirm(`Delete supplier ${supplier.name}?`)) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete supplier");
      setStatus("Supplier deleted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete supplier");
    }
  };

  return (
    <div className="space-y-6">
      {status ? <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{form.id ? "Edit Supplier" : "Create Supplier"}</h2>
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" required />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Address" />
          <div className="md:col-span-2 flex items-center gap-3">
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{form.id ? "Save changes" : "Create supplier"}</button>
            {form.id ? <button type="button" className="text-sm text-zinc-600" onClick={reset}>Cancel</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Suppliers</h2>
          <button type="button" onClick={load} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">Refresh</button>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading suppliers...</p>
        ) : (
          <div className="space-y-3">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="rounded-2xl border border-zinc-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">{supplier.name}</p>
                    <p className="text-xs text-zinc-500">{supplier.email ?? "—"} · {supplier.phone ?? "—"}</p>
                    <p className="text-xs text-zinc-500">{supplier.address ?? "—"}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button className="text-zinc-600" onClick={() => setForm({ id: supplier.id, name: supplier.name, email: supplier.email ?? "", phone: supplier.phone ?? "", address: supplier.address ?? "" })}>Edit</button>
                    <button className="text-red-600" onClick={() => remove(supplier)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
