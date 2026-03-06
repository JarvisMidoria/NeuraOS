"use client";

import { useEffect, useState } from "react";

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

  const loadWarehouses = async () => {
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
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

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
            <button type="button" className="text-sm font-medium text-zinc-600 hover:text-zinc-900" onClick={resetForm}>
              {t.cancelEdit}
            </button>
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
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
            >
              {isSubmitting ? t.saving : formData.id ? t.update : t.create}
            </button>
            {formData.id && (
              <button type="button" onClick={resetForm} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                {t.reset}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{t.warehouses}</h2>
            <p className="text-sm text-zinc-500">
              {warehouses.length} {t.total}
            </p>
          </div>
          <button type="button" onClick={loadWarehouses} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            {t.refresh}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">{t.loading}</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {warehouses.map((warehouse) => (
              <div key={warehouse.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-900">{warehouse.name}</p>
                  <p className="text-xs text-zinc-500">{warehouse.location ?? t.noLocation}</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button className="text-zinc-600 hover:text-zinc-900" onClick={() => handleEdit(warehouse)}>
                    {t.edit}
                  </button>
                  <button className="text-red-600 hover:text-red-800" onClick={() => handleDelete(warehouse)}>
                    {t.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
