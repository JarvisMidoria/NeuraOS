"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton, ActionLinkButton } from "../action-button";
import {
  AdminToolbar,
  AdminToolbarGroup,
  AdminToolbarInput,
  AdminToolbarSelect,
} from "../admin-toolbar";

type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: unknown;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type Payload = {
  page: number;
  pageSize: number;
  total: number;
  data: AuditRow[];
  filters: {
    entities: string[];
    actions: string[];
  };
};

const PAGE_SIZE = 30;

function entityHref(entity: string) {
  const key = String(entity || "").toLowerCase();
  if (key === "product") return "/admin/products";
  if (key === "supplier") return "/admin/suppliers";
  if (key === "warehouse") return "/admin/warehouses";
  if (key === "salesquote") return "/admin/sales/quotes";
  if (key === "salesorder") return "/admin/sales/orders";
  if (key === "purchaseorder") return "/admin/purchases/orders";
  if (key === "goodsreceipt") return "/admin/purchases/receipts";
  if (key === "stockmovement") return "/admin/stock";
  if (key === "taxrule" || key === "stockrule" || key === "role" || key === "user" || key === "customfielddefinition") {
    return "/admin/settings";
  }
  if (key === "ingestion_job") return "/admin/imports";
  return "";
}

export function AuditConsole({ lang }: { lang: "en" | "fr" }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entities, setEntities] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const text = useMemo(
    () => ({
      search: lang === "fr" ? "Recherche action, entite, acteur..." : "Search action, entity, actor...",
      entity: lang === "fr" ? "Entite" : "Entity",
      action: lang === "fr" ? "Action" : "Action",
      all: lang === "fr" ? "Tous" : "All",
      exportCsv: lang === "fr" ? "Exporter CSV" : "Export CSV",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement..." : "Loading...",
      empty: lang === "fr" ? "Aucun evenement" : "No events",
      date: lang === "fr" ? "Date" : "Date",
      actor: lang === "fr" ? "Acteur" : "Actor",
      record: lang === "fr" ? "Ressource" : "Record",
      metadata: lang === "fr" ? "Contexte" : "Context",
      page: lang === "fr" ? "Page" : "Page",
      previous: lang === "fr" ? "Precedent" : "Previous",
      next: lang === "fr" ? "Suivant" : "Next",
    }),
    [lang],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (query.trim()) params.set("q", query.trim());
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    return params.toString();
  }, [page, query, entity, action]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/audit/logs?${queryString}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as Payload;
      setRows(payload.data ?? []);
      setTotal(payload.total ?? 0);
      setEntities(payload.filters?.entities ?? []);
      setActions(payload.filters?.actions ?? []);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  const csvHref = `/api/audit/logs?${queryString}&format=csv`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <AdminToolbar>
          <AdminToolbarGroup className="w-full flex-1">
            <AdminToolbarInput
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder={text.search}
              className="min-w-[220px] flex-1 md:min-w-[280px]"
            />
            <AdminToolbarSelect
              value={entity}
              onChange={(event) => {
                setPage(1);
                setEntity(event.target.value);
              }}
              className="min-w-[170px]"
            >
              <option value="">{text.entity}: {text.all}</option>
              {entities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </AdminToolbarSelect>
            <AdminToolbarSelect
              value={action}
              onChange={(event) => {
                setPage(1);
                setAction(event.target.value);
              }}
              className="min-w-[190px]"
            >
              <option value="">{text.action}: {text.all}</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </AdminToolbarSelect>
          </AdminToolbarGroup>
          <AdminToolbarGroup align="end">
            <ActionLinkButton href={csvHref} icon="download" label={text.exportCsv} />
            <ActionButton type="button" icon="refresh" onClick={load} label={text.refresh} />
          </AdminToolbarGroup>
        </AdminToolbar>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="px-3 py-2">{text.date}</th>
                <th className="px-3 py-2">{text.action}</th>
                <th className="px-3 py-2">{text.entity}</th>
                <th className="px-3 py-2">{text.record}</th>
                <th className="px-3 py-2">{text.actor}</th>
                <th className="px-3 py-2">{text.metadata}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-3 py-6 text-zinc-500" colSpan={6}>
                    {text.loading}
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-zinc-500" colSpan={6}>
                    {text.empty}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="rounded-lg border border-zinc-100 bg-zinc-50">
                    <td className="px-3 py-2 text-zinc-700">{new Date(row.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</td>
                    <td className="px-3 py-2 font-medium text-zinc-900">{row.action}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.entity}</td>
                    <td className="px-3 py-2 text-zinc-700">
                      {entityHref(row.entity) ? (
                        <a
                          href={entityHref(row.entity)}
                          className="underline underline-offset-2 hover:text-zinc-900"
                          title={row.entityId}
                        >
                          {row.entityId}
                        </a>
                      ) : (
                        row.entityId
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{row.user?.name ?? "System"}</td>
                    <td className="max-w-[320px] px-3 py-2 text-xs text-zinc-600">
                      <pre className="overflow-auto whitespace-pre-wrap">{row.metadata ? JSON.stringify(row.metadata) : "-"}</pre>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>
            {text.page} {page}/{totalPages} · {total}
          </span>
          <div className="flex items-center gap-2">
            <ActionButton
              type="button"
              icon="left"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="disabled:cursor-not-allowed disabled:opacity-40"
              label={text.previous}
            />
            <ActionButton
              type="button"
              icon="right"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="disabled:cursor-not-allowed disabled:opacity-40"
              label={text.next}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
