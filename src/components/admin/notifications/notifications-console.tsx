"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton, ActionLinkButton } from "../action-button";
import { AdminToolbar, AdminToolbarGroup } from "../admin-toolbar";

type NotificationItem = {
  id: string;
  category: string;
  title: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

const BADGE_BY_SEVERITY: Record<NotificationItem["severity"], string> = {
  LOW: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-rose-100 text-rose-700",
};

export function NotificationsConsole({ lang }: { lang: "en" | "fr" }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const text = useMemo(
    () => ({
      title: lang === "fr" ? "Notifications" : "Notifications",
      subtitle:
        lang === "fr"
          ? "Alertes stock, ventes et operations pour ton equipe."
          : "Stock, sales and operations alerts for your team.",
      unread: lang === "fr" ? "Non lues" : "Unread",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      sync: lang === "fr" ? "Generer alertes" : "Generate alerts",
      markAll: lang === "fr" ? "Tout marquer lu" : "Mark all read",
      markRead: lang === "fr" ? "Marquer lu" : "Mark read",
      loading: lang === "fr" ? "Chargement..." : "Loading...",
      empty: lang === "fr" ? "Aucune notification" : "No notifications",
      emptyUnread: lang === "fr" ? "Aucune notification non lue" : "No unread notifications",
      low: lang === "fr" ? "Faible" : "Low",
      medium: lang === "fr" ? "Moyen" : "Medium",
      high: lang === "fr" ? "Eleve" : "High",
      all: lang === "fr" ? "Toutes" : "All",
      unreadOnly: lang === "fr" ? "Non lues" : "Unread only",
      details: lang === "fr" ? "Voir details" : "View details",
    }),
    [lang],
  );

  const severityLabel: Record<NotificationItem["severity"], string> = {
    LOW: text.low,
    MEDIUM: text.medium,
    HIGH: text.high,
  };

  const load = useCallback(async (sync = false) => {
    try {
      setLoading(true);
      const mode = sync ? "sync=1" : "auto=1";
      const response = await fetch(`/api/notifications?limit=100&${mode}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: NotificationItem[]; unread?: number };
      setItems(Array.isArray(payload.data) ? payload.data : []);
      setUnread(typeof payload.unread === "number" ? payload.unread : 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const markOneRead = async (notificationId: string) => {
    await fetch(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((item) => (item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item)));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
  };

  const filteredItems = useMemo(() => {
    if (filter === "unread") {
      return items.filter((item) => !item.readAt);
    }
    return items;
  }, [filter, items]);

  return (
    <div className="space-y-6">
      <section className="liquid-surface rounded-2xl p-5">
        <AdminToolbar>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--admin-text)]">{text.title}</h1>
            <p className="text-sm text-[var(--admin-muted)]">{text.subtitle}</p>
          </div>
          <AdminToolbarGroup align="end">
            <span className="liquid-pill px-3 py-1 text-xs font-medium text-[var(--admin-text)]">
              {text.unread}: {unread}
            </span>
          </AdminToolbarGroup>
        </AdminToolbar>

        <div className="mt-4">
          <AdminToolbarGroup>
            <ActionButton onClick={() => load(false)} icon="refresh" label={text.refresh} />
            <ActionButton onClick={() => load(true)} icon="refresh" label={text.sync} />
            <ActionButton onClick={markAllRead} icon="apply" label={text.markAll} />
            <ActionButton
              onClick={() => setFilter("all")}
              icon={filter === "all" ? "apply" : "plus"}
              label={text.all}
              className={filter === "all" ? "liquid-selected" : undefined}
            />
            <ActionButton
              onClick={() => setFilter("unread")}
              icon={filter === "unread" ? "apply" : "plus"}
              label={text.unreadOnly}
              className={filter === "unread" ? "liquid-selected" : undefined}
            />
          </AdminToolbarGroup>
        </div>
      </section>

      <section className="liquid-surface rounded-2xl p-5">
        <div className="space-y-3">
          {loading && <p className="text-sm text-[var(--admin-muted)]">{text.loading}</p>}
          {!loading && filteredItems.length === 0 && (
            <p className="text-sm text-[var(--admin-muted)]">{filter === "unread" ? text.emptyUnread : text.empty}</p>
          )}
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className={`liquid-surface rounded-xl p-4 ${item.readAt ? "" : "liquid-selected"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {item.href ? (
                  <a
                    href={item.href}
                    className="text-sm font-semibold text-[var(--admin-text)] underline-offset-2 hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <h3 className="text-sm font-semibold text-[var(--admin-text)]">{item.title}</h3>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_BY_SEVERITY[item.severity]}`}>
                  {severityLabel[item.severity]}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--admin-text)]">{item.message}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--admin-muted)]">
                <span>{new Date(item.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</span>
                <div className="flex items-center gap-2">
                  {item.href && (
                    <ActionLinkButton
                      href={item.href}
                      icon="right"
                      label={text.details}
                      className="px-2.5 py-1 text-xs"
                    />
                  )}
                  {!item.readAt && (
                    <ActionButton
                      onClick={() => markOneRead(item.id)}
                      icon="apply"
                      size="sm"
                      label={text.markRead}
                      className="text-xs"
                    />
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
