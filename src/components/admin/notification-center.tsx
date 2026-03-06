"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type NotificationCenterProps = {
  lang: "en" | "fr";
};

const SEVERITY_CLASS: Record<NotificationItem["severity"], string> = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-rose-500",
};

export function NotificationCenter({ lang }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const text = useMemo(
    () => ({
      title: lang === "fr" ? "Notifications" : "Notifications",
      empty: lang === "fr" ? "Aucune notification" : "No notifications",
      markAll: lang === "fr" ? "Tout marquer comme lu" : "Mark all as read",
      sync: lang === "fr" ? "Actualiser" : "Refresh",
      loading: lang === "fr" ? "Chargement..." : "Loading...",
    }),
    [lang],
  );

  const loadNotifications = async (sync = false) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notifications?limit=20${sync ? "&sync=1" : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: NotificationItem[]; unread?: number };
      setItems(Array.isArray(payload.data) ? payload.data : []);
      setUnread(typeof payload.unread === "number" ? payload.unread : 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(true);
    const id = window.setInterval(() => {
      loadNotifications(false);
    }, 45_000);
    return () => window.clearInterval(id);
  }, []);

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg border border-white/15 p-2 text-zinc-200 hover:bg-white/10"
        aria-label={text.title}
      >
        <span className="text-sm">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(90vw,380px)] rounded-xl border border-white/10 bg-[#0a0f1d] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-100">{text.title}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadNotifications(true)}
                className="rounded border border-white/15 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
              >
                {text.sync}
              </button>
              <button
                type="button"
                onClick={markAllRead}
                className="rounded border border-white/15 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
              >
                {text.markAll}
              </button>
            </div>
          </div>

          <div className="max-h-80 space-y-2 overflow-auto">
            {loading && <p className="text-xs text-zinc-400">{text.loading}</p>}
            {!loading && items.length === 0 && <p className="text-xs text-zinc-400">{text.empty}</p>}
            {items.map((item) => {
              const content = (
                <div className={`rounded-lg border px-3 py-2 ${item.readAt ? "border-white/10" : "border-white/25 bg-white/5"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                    <span className={`h-2.5 w-2.5 rounded-full ${SEVERITY_CLASS[item.severity]}`} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{item.message}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">
                      {new Date(item.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
                    </span>
                    {!item.readAt && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          markOneRead(item.id);
                        }}
                        className="text-[11px] text-zinc-300 hover:text-zinc-100"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              );

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      if (!item.readAt) markOneRead(item.id);
                      setOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                );
              }

              return <div key={item.id}>{content}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
