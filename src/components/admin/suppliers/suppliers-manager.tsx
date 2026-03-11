"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";
import { AdminModal } from "../admin-modal";
import { AdminInlineAlert } from "../admin-inline-alert";

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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
    addSupplier: lang === "fr" ? "Ajouter fournisseur" : "Add supplier",
    noSuppliers: lang === "fr" ? "Aucun fournisseur." : "No suppliers yet.",
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

  const openCreate = () => {
    reset();
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    reset();
    setIsEditorOpen(false);
  };

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
      closeEditor();
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
    setForm({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
    });
    setIsEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      {status ? <AdminInlineAlert tone="success">{status}</AdminInlineAlert> : null}
      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <div className="liquid-surface rounded-2xl p-6">
        <div className="mb-4">
          <AdminToolbar>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.suppliers}</h2>
            <AdminToolbarGroup align="end">
              <ActionButton type="button" icon="plus" tone="primary" onClick={openCreate} label={t.addSupplier} />
              <ActionButton type="button" icon="refresh" onClick={load} label={t.refresh} />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">{t.loading}</p>
        ) : suppliers.length === 0 ? (
          <div className="liquid-surface rounded-2xl p-5">
            <p className="text-sm text-[var(--admin-muted)]">{t.noSuppliers}</p>
            <div className="mt-3">
              <ActionButton type="button" icon="plus" tone="primary" onClick={openCreate} label={t.addSupplier} />
            </div>
          </div>
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
                className="liquid-surface rounded-2xl p-4 transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--admin-text)]">{supplier.name}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{supplier.email ?? "—"} · {supplier.phone ?? "—"}</p>
                    <p className="text-xs text-[var(--admin-muted)]">{supplier.address ?? "—"}</p>
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

      <AdminModal
        open={isEditorOpen}
        onClose={closeEditor}
        title={form.id ? t.editSupplier : t.createSupplier}
        maxWidthClassName="max-w-2xl"
      >
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <input
            className="admin-toolbar-control"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder={t.name}
            required
          />
          <input
            className="admin-toolbar-control"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder={t.email}
          />
          <input
            className="admin-toolbar-control"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder={t.phone}
          />
          <input
            className="admin-toolbar-control"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            placeholder={t.address}
          />
          <div className="flex items-center gap-3 md:col-span-2">
            <ActionButton tone="primary" icon="save" type="submit" label={form.id ? t.saveChanges : t.create} />
            <ActionButton icon="close" size="sm" type="button" label={t.cancel} onClick={closeEditor} />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
