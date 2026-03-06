"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { NeuraLogo } from "@/components/brand/neura-logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { NotificationCenter } from "@/components/admin/notification-center";

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    const cookieLang = document.cookie.match(/(?:^|;\s*)neura_lang=([^;]+)/)?.[1];
    const localLang = window.localStorage.getItem("neura_lang");
    setLang((cookieLang || localLang) === "fr" ? "fr" : "en");
  }, []);

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
      admin: lang === "fr" ? "Admin" : "Admin",
    }),
    [lang],
  );

  return (
    <div className="admin-shell min-h-screen overflow-x-hidden bg-[#080b12] text-zinc-100">
      <div className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-40 hidden lg:flex">
        <NotificationCenter lang={lang} />
      </div>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#080b12]/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-white/15 p-2 text-zinc-200"
          aria-label={text.menu}
        >
          <span className="flex h-4 w-4 flex-col justify-between">
            <span className="h-[2px] w-full rounded bg-current" />
            <span className="h-[2px] w-full rounded bg-current" />
            <span className="h-[2px] w-full rounded bg-current" />
          </span>
        </button>
        <NeuraLogo compact href="/admin" />
        <div className="flex items-center gap-2">
          <NotificationCenter lang={lang} />
          <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-zinc-300">
            {text.admin}
          </span>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-57px)] w-full max-w-[1400px] grid-cols-1 pt-[calc(57px+env(safe-area-inset-top))] lg:min-h-screen lg:grid-cols-[280px_1fr] lg:pt-0">
        <aside className="hidden border-r border-white/10 px-5 py-6 lg:block">
          <div className="mb-8 flex items-center justify-between">
            <NeuraLogo href="/admin" />
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-zinc-300">
              {text.admin}
            </span>
          </div>
          <AdminNav />
        </aside>

        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/55 transition ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        } lg:hidden`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[88%] max-w-[320px] border-r border-white/10 bg-[#080b12] px-4 py-5 transition-transform duration-200 will-change-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <NeuraLogo href="/admin" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-zinc-300"
          >
            {text.close}
          </button>
        </div>
        <AdminNav onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>
  );
}
