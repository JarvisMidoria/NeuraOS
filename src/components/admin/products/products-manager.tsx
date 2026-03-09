"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup, AdminToolbarSelect } from "../admin-toolbar";

type Category = {
  id: string;
  name: string;
};

type CustomFieldDefinition = {
  id: string;
  label: string;
  fieldKey: string;
  fieldType: string;
};

type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unitPrice: string;
  unitOfMeasure: string;
  isActive: boolean;
  lowStockThreshold?: string | null;
  category: Category | null;
  customFields: Array<{
    fieldId: string;
    label: string;
    value: string;
  }>;
};

interface ProductsManagerProps {
  categories: Category[];
  customFieldDefinitions: CustomFieldDefinition[];
  lang: "en" | "fr";
  companySettings: {
    productUnitMode: "GLOBAL" | "PER_PRODUCT";
    defaultProductUnit: "EA" | "M" | "L" | "KG";
    currencyCode: string;
  };
}

const PAGE_SIZE = 10;
const ALLOWED_UNITS = new Set(["EA", "M", "L", "KG"]);

export function ProductsManager({
  categories,
  customFieldDefinitions,
  lang,
  companySettings,
}: ProductsManagerProps) {
  const normalizeUnit = (value: string): "EA" | "M" | "L" | "KG" =>
    ALLOWED_UNITS.has(value) ? (value as "EA" | "M" | "L" | "KG") : companySettings.defaultProductUnit;

  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    sku: "",
    name: "",
    description: "",
    unitPrice: "",
    unitOfMeasure: companySettings.defaultProductUnit,
    categoryId: "",
    lowStockThreshold: "",
    restockAlertEnabled: false,
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const t = useMemo(
    () => ({
      loadFailed: lang === "fr" ? "Impossible de charger les produits" : "Failed to load products",
      deleteConfirm: lang === "fr" ? "Supprimer ce produit ?" : "Delete this product?",
      deleteFailed: lang === "fr" ? "Impossible de supprimer le produit" : "Unable to delete product",
      saveFailed: lang === "fr" ? "Impossible d'enregistrer le produit" : "Failed to save product",
      edit: lang === "fr" ? "Modifier le produit" : "Edit Product",
      create: lang === "fr" ? "Creer un produit" : "Create Product",
      formHelp:
        lang === "fr"
          ? "Gerez les informations produit et attributs personnalises."
          : "Manage core product information and custom attributes.",
      cancelEdit: lang === "fr" ? "Annuler" : "Cancel edit",
      sku: "SKU",
      name: lang === "fr" ? "Nom" : "Name",
      unitPrice: lang === "fr" ? "Prix unitaire" : "Unit Price",
      uom: lang === "fr" ? "Unite" : "Unit of Measure",
      unitModeGlobal:
        lang === "fr"
          ? "Mode global actif: unite unique appliquee a tous les produits."
          : "Global mode enabled: one unit is applied to all products.",
      category: lang === "fr" ? "Categorie" : "Category",
      uncategorized: lang === "fr" ? "Sans categorie" : "Uncategorized",
      lowStock: lang === "fr" ? "Seuil alerte restock" : "Restock alert threshold",
      restockEnabled: lang === "fr" ? "Activer alerte restock" : "Enable restock alert",
      description: lang === "fr" ? "Description" : "Description",
      lowStockPlaceholder: lang === "fr" ? "ex: 10" : "e.g. 10",
      customFields: lang === "fr" ? "Champs personnalises" : "Custom Fields",
      saving: lang === "fr" ? "Enregistrement..." : "Saving...",
      update: lang === "fr" ? "Mettre a jour" : "Update Product",
      createBtn: lang === "fr" ? "Creer le produit" : "Create Product",
      reset: lang === "fr" ? "Reinitialiser" : "Reset",
      products: lang === "fr" ? "Produits" : "Products",
      showing: lang === "fr" ? "Affichage" : "Showing",
      of: lang === "fr" ? "sur" : "of",
      allCategories: lang === "fr" ? "Toutes les categories" : "All categories",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement des produits..." : "Loading products...",
      customValuesEmpty: lang === "fr" ? "Aucune valeur personnalisee" : "No custom values",
      editRow: lang === "fr" ? "Modifier" : "Edit",
      deleteRow: lang === "fr" ? "Supprimer" : "Delete",
      page: lang === "fr" ? "Page" : "Page",
      previous: lang === "fr" ? "Precedent" : "Previous",
      next: lang === "fr" ? "Suivant" : "Next",
    }),
    [lang],
  );

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const resetForm = () => {
    setFormData({
      id: "",
      sku: "",
      name: "",
      description: "",
      unitPrice: "",
      unitOfMeasure: companySettings.defaultProductUnit,
      categoryId: "",
      lowStockThreshold: "",
      restockAlertEnabled: false,
    });
    setCustomValues({});
  };

  useEffect(() => {
    if (companySettings.productUnitMode !== "GLOBAL") return;
    setFormData((prev) => ({ ...prev, unitOfMeasure: companySettings.defaultProductUnit }));
  }, [companySettings.defaultProductUnit, companySettings.productUnitMode]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      });
      if (categoryFilter !== "all") {
        params.set("categoryId", categoryFilter);
      }
      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error(t.loadFailed);
      }
      const payload = await response.json();
      setProducts(payload.data ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter, t.loadFailed]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);


  const handleEdit = (product: ProductRecord) => {
    setFormData({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description ?? "",
      unitPrice: product.unitPrice,
      unitOfMeasure: normalizeUnit(product.unitOfMeasure),
      categoryId: product.category?.id ?? "",
      lowStockThreshold: product.lowStockThreshold ?? "",
      restockAlertEnabled: Boolean(product.lowStockThreshold),
    });
    const fieldMap: Record<string, string> = {};
    product.customFields.forEach((field) => {
      fieldMap[field.fieldId] = field.value;
    });
    setCustomValues(fieldMap);
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t.deleteFailed);
      }
      await loadProducts();
      if (formData.id === productId) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteFailed);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || null,
        unitPrice: formData.unitPrice,
        unitOfMeasure: formData.unitOfMeasure,
        categoryId: formData.categoryId || null,
        lowStockThreshold:
          formData.restockAlertEnabled && formData.lowStockThreshold
            ? formData.lowStockThreshold
            : null,
        customFieldValues: customFieldDefinitions.map((definition) => ({
          fieldId: definition.id,
          value: customValues[definition.id] ?? "",
        })),
      };

      const endpoint = formData.id ? `/api/products/${formData.id}` : "/api/products";
      const method = formData.id ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? t.saveFailed);
      }

      await loadProducts();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {formData.id ? t.edit : t.create}
            </h2>
            <p className="text-sm text-zinc-500">
              {t.formHelp}
            </p>
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
            <label className="text-sm font-medium text-zinc-700">{t.sku}</label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={formData.sku}
              onChange={(event) => setFormData((prev) => ({ ...prev, sku: event.target.value }))}
              required
            />
          </div>
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
            <label className="text-sm font-medium text-zinc-700">{t.unitPrice}</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={formData.unitPrice}
              onChange={(event) => setFormData((prev) => ({ ...prev, unitPrice: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">{t.uom}</label>
            {companySettings.productUnitMode === "GLOBAL" ? (
              <>
                <input
                  className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                  value={companySettings.defaultProductUnit}
                  disabled
                />
                <p className="text-xs text-zinc-500">{t.unitModeGlobal}</p>
              </>
            ) : (
              <select
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={formData.unitOfMeasure}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, unitOfMeasure: normalizeUnit(event.target.value) }))
                }
                required
              >
                <option value="EA">Units (EA)</option>
                <option value="M">Meters (M)</option>
                <option value="L">Liters (L)</option>
                <option value="KG">Kilograms (KG)</option>
              </select>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">{t.category}</label>
            <select
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={formData.categoryId}
              onChange={(event) => setFormData((prev) => ({ ...prev, categoryId: event.target.value }))}
            >
              <option value="">{t.uncategorized}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">{t.lowStock}</label>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={formData.restockAlertEnabled}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    restockAlertEnabled: event.target.checked,
                    lowStockThreshold:
                      event.target.checked ? prev.lowStockThreshold || "" : "",
                  }))
                }
              />
              {t.restockEnabled}
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={formData.lowStockThreshold}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, lowStockThreshold: event.target.value }))
              }
              placeholder={t.lowStockPlaceholder}
              disabled={!formData.restockAlertEnabled}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-zinc-700">{t.description}</label>
            <textarea
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              rows={3}
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          {customFieldDefinitions.length > 0 && (
            <div className="md:col-span-2 space-y-4">
              <p className="text-sm font-medium text-zinc-700">{t.customFields}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {customFieldDefinitions.map((definition) => (
                  <div key={definition.id} className="space-y-2">
                    <label className="text-sm text-zinc-700">{definition.label}</label>
                    <input
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={customValues[definition.id] ?? ""}
                      onChange={(event) =>
                        setCustomValues((prev) => ({ ...prev, [definition.id]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex items-center gap-3">
            <ActionButton
              type="submit"
              icon="save"
              tone="primary"
              disabled={isSubmitting}
              className="disabled:opacity-70"
            >
              {isSubmitting ? t.saving : formData.id ? t.update : t.createBtn}
            </ActionButton>
            {formData.id && (
              <ActionButton
                type="button"
                icon="close"
                onClick={resetForm}
                label={t.reset}
              />
            )}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <AdminToolbar>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{t.products}</h2>
              <p className="text-sm text-zinc-500">
                {t.showing} {products.length} {t.of} {total} {lang === "fr" ? "produits" : "products"}
              </p>
            </div>
            <AdminToolbarGroup align="end">
              <AdminToolbarSelect
                value={categoryFilter}
                onChange={(event) => handleCategoryChange(event.target.value)}
              >
                <option value="all">{t.allCategories}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </AdminToolbarSelect>
              <ActionButton
                type="button"
                icon="refresh"
                onClick={loadProducts}
                label={t.refresh}
              />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">{t.loading}</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(product)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleEdit(product);
                  }
                }}
                className="rounded-2xl border border-zinc-100 p-4 transition hover:border-zinc-300 cursor-pointer"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="space-y-2">
                    <p className="font-mono text-xs text-zinc-500">{product.sku}</p>
                    <p className="text-base font-semibold text-zinc-900">{product.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                      <span className="rounded-full bg-zinc-100 px-2 py-1">
                        {t.category}: {product.category?.name ?? "—"}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-1">
                        {t.unitPrice}: {Number(product.unitPrice ?? 0).toFixed(2)} {companySettings.currencyCode}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-1">
                        {t.lowStock}: {product.lowStockThreshold ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-zinc-600">
                      {product.customFields.length ? (
                        product.customFields.map((field) => (
                          <span key={field.fieldId} className="rounded-full bg-zinc-100 px-2 py-0.5">
                            {field.label}: {field.value}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400">{t.customValuesEmpty}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs md:justify-end">
                    <ActionButton
                      icon="edit"
                      iconOnly
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(product);
                      }}
                      label={t.editRow}
                      title={t.editRow}
                    />
                    <ActionButton
                      icon="delete"
                      iconOnly
                      size="icon"
                      tone="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(product.id);
                      }}
                      label={t.deleteRow}
                      title={t.deleteRow}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>
            {t.page} {page} {t.of} {totalPages}
          </span>
          <div className="flex gap-2">
            <ActionButton
              type="button"
              icon="left"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="disabled:opacity-40"
              label={t.previous}
            />
            <ActionButton
              type="button"
              icon="right"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="disabled:opacity-40"
              label={t.next}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
