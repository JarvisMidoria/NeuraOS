"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { AdminToolbar, AdminToolbarGroup } from "@/components/admin/admin-toolbar";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminInlineAlert } from "@/components/admin/admin-inline-alert";

type ClientRecord = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
  _count: {
    salesQuotes: number;
    salesOrders: number;
  };
};

type ClientsManagerProps = {
  lang: "en" | "fr";
};

export function ClientsManager({ lang }: ClientsManagerProps) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = {
    clients: lang === "fr" ? "Clients" : "Clients",
    totalClients: lang === "fr" ? "Total clients" : "Total clients",
    loading: lang === "fr" ? "Chargement des clients..." : "Loading clients...",
    addClient: lang === "fr" ? "Ajouter client" : "Add client",
    editClient: lang === "fr" ? "Modifier client" : "Edit client",
    createClient: lang === "fr" ? "Creer client" : "Create client",
    formHelp:
      lang === "fr"
        ? "Annuaire clients utilise pour les devis et commandes."
        : "Customer directory used for quotes and orders.",
    save: lang === "fr" ? "Enregistrer" : "Save",
    saving: lang === "fr" ? "Enregistrement..." : "Saving...",
    cancel: lang === "fr" ? "Annuler" : "Cancel",
    refresh: lang === "fr" ? "Actualiser" : "Refresh",
    name: lang === "fr" ? "Nom" : "Name",
    email: "Email",
    phone: lang === "fr" ? "Telephone" : "Phone",
    address: lang === "fr" ? "Adresse" : "Address",
    delete: lang === "fr" ? "Supprimer" : "Delete",
    edit: lang === "fr" ? "Modifier" : "Edit",
    openQuotes: lang === "fr" ? "Voir devis" : "Open quotes",
    openOrders: lang === "fr" ? "Voir commandes" : "Open orders",
    noClients: lang === "fr" ? "Aucun client" : "No clients yet",
    created: lang === "fr" ? "Client cree" : "Client created",
    updated: lang === "fr" ? "Client mis a jour" : "Client updated",
    deleted: lang === "fr" ? "Client supprime" : "Client deleted",
    loadFailed: lang === "fr" ? "Impossible de charger les clients" : "Failed to load clients",
    saveFailed: lang === "fr" ? "Impossible d'enregistrer le client" : "Failed to save client",
    deleteFailed: lang === "fr" ? "Impossible de supprimer le client" : "Failed to delete client",
    deleteConfirm: lang === "fr" ? "Supprimer le client" : "Delete client",
  };

  const resetForm = () => setForm({ id: "", name: "", email: "", phone: "", address: "" });

  const closeEditor = () => {
    resetForm();
    setIsEditorOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clients");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? t.loadFailed);
      }
      setClients(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const startEdit = (client: ClientRecord) => {
    setForm({
      id: client.id,
      name: client.name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
    });
    setIsEditorOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const endpoint = form.id ? `/api/clients/${form.id}` : "/api/clients";
      const method = form.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? t.saveFailed);
      }
      setStatus(form.id ? t.updated : t.created);
      closeEditor();
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (client: ClientRecord) => {
    if (!window.confirm(`${t.deleteConfirm} ${client.name} ?`)) return;

    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? t.deleteFailed);
      }
      setStatus(t.deleted);
      if (form.id === client.id) {
        closeEditor();
      }
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deleteFailed);
    }
  };

  return (
    <div className="space-y-6">
      {status ? <AdminInlineAlert tone="success">{status}</AdminInlineAlert> : null}
      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <div className="liquid-surface rounded-2xl p-4 sm:p-6">
        <div className="mb-4">
          <AdminToolbar>
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{t.clients}</h2>
              <p className="text-sm text-[var(--admin-muted)]">
                {t.totalClients}: {clients.length}
              </p>
            </div>
            <AdminToolbarGroup align="end">
              <ActionButton type="button" icon="plus" tone="primary" onClick={openCreate} label={t.addClient} />
              <ActionButton type="button" icon="refresh" onClick={loadClients} label={t.refresh} />
            </AdminToolbarGroup>
          </AdminToolbar>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">{t.loading}</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-[var(--admin-muted)]">{t.noClients}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {clients.map((client) => (
              <article
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => startEdit(client)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    startEdit(client);
                  }
                }}
                className="liquid-surface rounded-xl p-3 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--admin-text)]">{client.name}</p>
                  <div className="flex gap-1">
                    <Link
                      href={`/admin/sales/quotes?clientId=${encodeURIComponent(client.id)}`}
                      className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-200"
                    >
                      Q {client._count.salesQuotes}
                    </Link>
                    <Link
                      href={`/admin/sales/orders?clientId=${encodeURIComponent(client.id)}`}
                      className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-200"
                    >
                      O {client._count.salesOrders}
                    </Link>
                  </div>
                </div>
                <div className="mt-1 space-y-1 text-xs text-[var(--admin-muted)]">
                  {client.email ? (
                    <a
                      className="block hover:text-[var(--admin-text)]"
                      href={`mailto:${client.email}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {client.email}
                    </a>
                  ) : (
                    <p>—</p>
                  )}
                  {client.phone ? (
                    <a
                      className="block hover:text-[var(--admin-text)]"
                      href={`tel:${client.phone}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {client.phone}
                    </a>
                  ) : (
                    <p>—</p>
                  )}
                  <p>{client.address ?? "—"}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ActionButton
                    icon="edit"
                    iconOnly
                    size="icon"
                    label={t.edit}
                    title={t.edit}
                    onClick={(event) => {
                      event.stopPropagation();
                      startEdit(client);
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
                      handleDelete(client);
                    }}
                  />
                  <Link
                    href={`/admin/sales/quotes?clientId=${encodeURIComponent(client.id)}`}
                    className="liquid-pill px-2 py-1 text-xs text-[var(--admin-text)] transition"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t.openQuotes}
                  </Link>
                  <Link
                    href={`/admin/sales/orders?clientId=${encodeURIComponent(client.id)}`}
                    className="liquid-pill px-2 py-1 text-xs text-[var(--admin-text)] transition"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t.openOrders}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <AdminModal
        open={isEditorOpen}
        onClose={closeEditor}
        title={form.id ? t.editClient : t.createClient}
        subtitle={t.formHelp}
        maxWidthClassName="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <input
            className="admin-toolbar-control"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t.name}
            required
          />
          <input
            className="admin-toolbar-control"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder={t.email}
          />
          <input
            className="admin-toolbar-control"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder={t.phone}
          />
          <input
            className="admin-toolbar-control"
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            placeholder={t.address}
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <ActionButton
              type="submit"
              tone="primary"
              icon="save"
              disabled={isSubmitting}
              label={isSubmitting ? t.saving : t.save}
            />
            <ActionButton type="button" icon="close" onClick={closeEditor} label={t.cancel} />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
