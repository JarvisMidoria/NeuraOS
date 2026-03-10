"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";

type Supplier = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export function SuppliersManager({ lang = "en" }: { lang?: "en" | "fr" }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", email: "", phone: "", address: "" });
  const t = {
    loadFailed: lang === "fr" ? "Impossible de charger les fournisseurs" : "Failed to load suppliers",
    saveFailed: lang === "fr" ? "Impossible d'enregistrer le fournisseur" : "Failed to save supplier",
    deleteFailed: lang === "fr" ? "Impossible de supprimer le fournisseur" : "Failed to delete supplier",
    deleteConfirm: lang === "fr" ? "Supprimer le fournisseur" : "Delete supplier",
    supplierUpdated: lang === "fr" ? "Fournisseur mis a jour" : "Supplier updated",
    supplierCreated: lang === "fr" ? "Fournisseur cree" : "Supplier created",
    supplierDeleted: lang === "fr" ? "Fournisseur supprime" : "Supplier deleted",
    editSupplier: lang === "fr" ? "Modifier le fournisseur" : "Edit Supplier",
    createSupplier: lang === "fr" ? "Creer un fournisseur" : "Create Supplier",
    saveChanges: lang === "fr" ? "Enregistrer" : "Save changes",
    create: lang === "fr" ? "Creer fournisseur" : "Create supplier",
    cancel: lang === "fr" ? "Annuler" : "Cancel",
    suppliers: lang === "fr" ? "Fournisseurs" : "Suppliers",
    loading: lang === "fr" ? "Chargement des fournisseurs..." : "Loading suppliers...",
    refresh: lang === "fr" ? "Actualiser" : "Refresh",
    edit: lang === "fr" ? "Modifier" : "Edit",
    delete: lang === "fr" ? "Supprimer" : "Delete",
    name: lang === "fr" ? "Nom" : "Name",
    email: lang === "fr" ? "Email" : "Email",
    phone: lang === "fr" ? "Telephone" : "Phone",
    address: lang === "fr" ? "Adresse" : "Address",
    showSection: lang === "fr" ? "Afficher" : "Show",
    hideSection: lang === "fr" ? "Masquer" : "Hide",
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/suppliers");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.loadFailed);
      setSuppliers(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

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
      if (!res.ok) throw new Error(body.error ?? t.saveFailed);
      setStatus(form.id ? t.supplierUpdated : t.supplierCreated);
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    }
  };

  const remove = async (supplier: Supplier) => {
    if (!window.confirm(`${t.deleteConfirm} ${supplier.name} ?`)) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t.deleteFailed);
      setStatus(t.supplierDeleted);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteFailed);
    }
  };

  const startEdit = (supplier: Supplier) => {
    setShowForm(true);
    setForm({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
    });
  };

  return (
    <div className="space-y-6">
      {status ? <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">{form.id ? t.editSupplier : t.createSupplier}</h2>
          <ActionButton
            type="button"
            size="sm"
            icon={showForm ? "close" : "plus"}
            onClick={() => setShowForm((prev) => !prev)}
            label={showForm ? t.hideSection : t.showSection}
          />
        </div>
        {showForm ? (
          <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t.name} required />
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder={t.email} />
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder={t.phone} />
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder={t.address} />
            <div className="md:col-span-2 flex items-center gap-3">
              <ActionButton tone="primary" icon="save" type="submit" label={form.id ? t.saveChanges : t.create} />
              {form.id ? <ActionButton icon="close" size="sm" type="button" label={t.cancel} onClick={reset} /> : null}
            </div>
          </form>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <AdminToolbar>
            <h2 className="text-lg font-semibold text-zinc-900">{t.suppliers}</h2>
            <AdminToolbarGroup align="end">
              <ActionButton
                type="button"
                icon={showList ? "close" : "plus"}
                onClick={() => setShowList((prev) => !prev)}
                label={showList ? t.hideSection : t.showSection}
              />
              <ActionButton type="button" icon="refresh" onClick={load} label={t.refresh} />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>
        {!showList ? null : loading ? (
          <p className="text-sm text-zinc-500">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {suppliers.map((supplier) => (
              <div
                key={supplier.id}
                role="button"
                tabIndex={0}
                onClick={() => startEdit(supplier)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    startEdit(supplier);
                  }
                }}
                className="rounded-2xl border border-zinc-100 p-4 transition hover:border-zinc-300 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">{supplier.name}</p>
                    <p className="text-xs text-zinc-500">{supplier.email ?? "—"} · {supplier.phone ?? "—"}</p>
                    <p className="text-xs text-zinc-500">{supplier.address ?? "—"}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <ActionButton
                      icon="edit"
                      iconOnly
                      size="icon"
                      label={t.edit}
                      title={t.edit}
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(supplier);
                      }}
                    />
                    <ActionButton
                      icon="delete"
                      iconOnly
                      size="icon"
                      tone="danger"
                      label={t.delete}
                      title={t.delete}
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(supplier);
                      }}
                    />
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
