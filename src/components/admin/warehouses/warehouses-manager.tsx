"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";
import { AdminModal } from "../admin-modal";

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
  const [isEditorOpen, setIsEditorOpen] = useState(false);

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
    addWarehouse: lang === "fr" ? "Ajouter entrepot" : "Add warehouse",
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

  const openCreate = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    resetForm();
    setIsEditorOpen(false);
  };

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
      closeEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setFormData({ id: warehouse.id, name: warehouse.name, location: warehouse.location ?? "" });
    setIsEditorOpen(true);
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
        closeEditor();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteFailed);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="liquid-surface rounded-xl p-6">
        <div className="mb-4">
          <AdminToolbar>
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.warehouses}</h2>
              <p className="text-sm text-[var(--admin-muted)]">
                {warehouses.length} {t.total}
              </p>
            </div>
            <AdminToolbarGroup align="end">
              <ActionButton type="button" icon="plus" tone="primary" onClick={openCreate} label={t.addWarehouse} />
              <ActionButton
                type="button"
                icon="refresh"
                onClick={loadWarehouses}
                label={t.refresh}
              />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">{t.loading}</p>
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
                className="liquid-surface flex items-center justify-between rounded-2xl p-4 text-sm transition cursor-pointer"
              >
                <div>
                  <p className="font-medium text-[var(--admin-text)]">{warehouse.name}</p>
                  <p className="text-xs text-[var(--admin-muted)]">{warehouse.location ?? t.noLocation}</p>
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

      <AdminModal
        open={isEditorOpen}
        onClose={closeEditor}
        title={formData.id ? t.editWarehouse : t.createWarehouse}
        subtitle={t.formHelp}
        maxWidthClassName="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--admin-text)]">{t.name}</label>
            <input
              className="admin-toolbar-control w-full"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--admin-text)]">{t.location}</label>
            <input
              className="admin-toolbar-control w-full"
              value={formData.location}
              onChange={(event) => setFormData((prev) => ({ ...prev, location: event.target.value }))}
              placeholder={t.optional}
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <ActionButton
              type="submit"
              icon="save"
              tone="primary"
              disabled={isSubmitting}
              className="disabled:opacity-70"
            >
              {isSubmitting ? t.saving : formData.id ? t.update : t.create}
            </ActionButton>
            {formData.id ? (
              <ActionButton type="button" icon="close" onClick={closeEditor} label={t.cancelEdit} />
            ) : (
              <ActionButton type="button" icon="close" onClick={closeEditor} label={t.reset} />
            )}
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
