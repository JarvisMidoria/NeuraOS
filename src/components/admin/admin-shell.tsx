"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { NeuraLogo } from "@/components/brand/neura-logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { NotificationCenter } from "@/components/admin/notification-center";
import { AiAssistantPopover } from "@/components/admin/ai-assistant-popover";

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang] = useState<"en" | "fr">(() => {
    if (typeof window === "undefined") return "en";
    const cookieLang = document.cookie.match(/(?:^|;\s*)neura_lang=([^;]+)/)?.[1];
    const localLang = window.localStorage.getItem("neura_lang");
    return (cookieLang || localLang) === "fr" ? "fr" : "en";
  });

  useEffect(() => {
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflowX = "";
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  const text = useMemo(
    () => ({
      menu: lang === "fr" ? "Menu" : "Menu",
      close: lang === "fr" ? "Fermer" : "Close",
    }),
    [lang],
  );

  return (
    <div className="admin-shell min-h-screen overflow-x-hidden text-[var(--admin-text)]">
      <div className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-40 hidden lg:flex">
        <div className="flex items-center gap-2">
          <AiAssistantPopover lang={lang} />
          <NotificationCenter lang={lang} />
        </div>
      </div>
      <header className="admin-topbar fixed inset-x-0 top-0 z-30 border-b px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="absolute left-4 top-[calc(0.75rem+env(safe-area-inset-top))] rounded-lg border p-2 text-[var(--admin-text)]"
          aria-label={text.menu}
        >
          <span className="flex h-4 w-4 flex-col justify-between">
            <span className="h-[2px] w-full rounded bg-current" />
            <span className="h-[2px] w-full rounded bg-current" />
            <span className="h-[2px] w-full rounded bg-current" />
          </span>
        </button>
        <div className="flex items-center justify-center">
          <NeuraLogo compact href="/admin" />
        </div>
        <div className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] flex items-center gap-2">
          <AiAssistantPopover lang={lang} />
          <NotificationCenter lang={lang} />
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-57px)] w-full max-w-[1400px] grid-cols-1 pt-[calc(57px+env(safe-area-inset-top))] lg:min-h-screen lg:grid-cols-[280px_1fr] lg:pt-0">
        <aside className="hidden border-r border-[var(--admin-border)] px-5 py-6 lg:block">
          <div className="mb-8 flex items-center justify-center">
            <NeuraLogo href="/admin" />
          </div>
          <AdminNav />
        </aside>

        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-[var(--admin-overlay)] transition ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        } lg:hidden`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`admin-mobile-drawer fixed inset-y-0 left-0 z-50 w-[88%] max-w-[320px] overflow-y-auto border-r px-4 py-5 transition-transform duration-200 will-change-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 mb-5 flex items-center justify-between pb-3">
          <NeuraLogo href="/admin" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md border px-2 py-1 text-base leading-none text-[var(--admin-text)]"
            aria-label={text.close}
            title={text.close}
          >
            ×
          </button>
        </div>
        <AdminNav onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>
  );
}
