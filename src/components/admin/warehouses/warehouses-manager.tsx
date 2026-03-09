"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";

type Warehouse = {
  id: string;
  name: string;
  location?: string | null;
};

export function WarehousesManager({ lang }: { lang: "en" | "fr" }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [formData, setFormData] = useState({ id: "", name: "", location: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const t = {
    loadFailed: lang === "fr" ? "Impossible de charger les entrepots" : "Failed to load warehouses",
    saveFailed: lang === "fr" ? "Impossible d'enregistrer l'entrepot" : "Failed to save warehouse",
    deleteFailed: lang === "fr" ? "Impossible de supprimer l'entrepot" : "Failed to delete warehouse",
    deleteConfirm: lang === "fr" ? "Supprimer l'entrepot" : "Delete warehouse",
    editWarehouse: lang === "fr" ? "Modifier l'entrepot" : "Edit Warehouse",
    createWarehouse: lang === "fr" ? "Creer un entrepot" : "Create Warehouse",
    formHelp:
      lang === "fr" ? "Definissez les lieux de stockage pour le suivi stock." : "Define storage locations for stock tracking.",
    cancelEdit: lang === "fr" ? "Annuler" : "Cancel edit",
    name: lang === "fr" ? "Nom" : "Name",
    location: lang === "fr" ? "Emplacement" : "Location",
    optional: lang === "fr" ? "Optionnel" : "Optional",
    saving: lang === "fr" ? "Enregistrement..." : "Saving...",
    update: lang === "fr" ? "Mettre a jour" : "Update Warehouse",
    create: lang === "fr" ? "Creer entrepot" : "Create Warehouse",
    reset: lang === "fr" ? "Reinitialiser" : "Reset",
    warehouses: lang === "fr" ? "Entrepots" : "Warehouses",
    total: lang === "fr" ? "au total" : "total",
    refresh: lang === "fr" ? "Actualiser" : "Refresh",
    loading: lang === "fr" ? "Chargement des entrepots..." : "Loading warehouses...",
    noLocation: lang === "fr" ? "Sans emplacement" : "No location",
    edit: lang === "fr" ? "Modifier" : "Edit",
    delete: lang === "fr" ? "Supprimer" : "Delete",
  };

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/warehouses");
      if (!response.ok) {
        throw new Error(t.loadFailed);
      }
      const payload = await response.json();
      setWarehouses(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const resetForm = () => setFormData({ id: "", name: "", location: "" });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = formData.id ? `/api/warehouses/${formData.id}` : "/api/warehouses";
      const method = formData.id ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          location: formData.location || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t.saveFailed);
      }

      await loadWarehouses();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setFormData({ id: warehouse.id, name: warehouse.name, location: warehouse.location ?? "" });
  };

  const handleDelete = async (warehouse: Warehouse) => {
    if (!window.confirm(`${t.deleteConfirm} ${warehouse.name} ?`)) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/warehouses/${warehouse.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t.deleteFailed);
      }
      await loadWarehouses();
      if (formData.id === warehouse.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteFailed);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{formData.id ? t.editWarehouse : t.createWarehouse}</h2>
            <p className="text-sm text-zinc-500">{t.formHelp}</p>
          </div>
          {formData.id && (
            <ActionButton
              type="button"
              icon="close"
              size="sm"
              onClick={resetForm}
              label={t.cancelEdit}
            />
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">{t.name}</label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">{t.location}</label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={formData.location}
              onChange={(event) => setFormData((prev) => ({ ...prev, location: event.target.value }))}
              placeholder={t.optional}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <ActionButton
              type="submit"
              icon="save"
              tone="primary"
              disabled={isSubmitting}
              className="disabled:opacity-70"
            >
              {isSubmitting ? t.saving : formData.id ? t.update : t.create}
            </ActionButton>
            {formData.id && (
              <ActionButton type="button" icon="close" onClick={resetForm} label={t.reset} />
            )}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <AdminToolbar>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{t.warehouses}</h2>
              <p className="text-sm text-zinc-500">
                {warehouses.length} {t.total}
              </p>
            </div>
            <AdminToolbarGroup align="end">
              <ActionButton type="button" icon="refresh" onClick={loadWarehouses} label={t.refresh} />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(warehouse)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleEdit(warehouse);
                  }
                }}
                className="flex items-center justify-between rounded-2xl border border-zinc-100 p-4 text-sm transition hover:border-zinc-300 cursor-pointer"
              >
                <div>
                  <p className="font-medium text-zinc-900">{warehouse.name}</p>
                  <p className="text-xs text-zinc-500">{warehouse.location ?? t.noLocation}</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <ActionButton
                    icon="edit"
                    iconOnly
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEdit(warehouse);
                    }}
                    label={t.edit}
                    title={t.edit}
                  />
                  <ActionButton
                    icon="delete"
                    iconOnly
                    size="icon"
                    tone="danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(warehouse);
                    }}
                    label={t.delete}
                    title={t.delete}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
