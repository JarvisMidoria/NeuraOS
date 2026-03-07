"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NeuraLogo } from "@/components/brand/neura-logo";
import { MasterNav } from "@/components/master/master-nav";

function BellIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 18H16M6 16.5H18C16.6 15.2 16 13.5 16 11V10C16 7.8 14.2 6 12 6C9.8 6 8 7.8 8 10V11C8 13.5 7.4 15.2 6 16.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MasterShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <div className="admin-shell min-h-screen overflow-x-hidden text-[var(--admin-text)]">
      <header className="admin-topbar fixed inset-x-0 top-0 z-30 border-b px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="absolute left-4 top-[calc(0.75rem+env(safe-area-inset-top))] rounded-lg border p-2 text-[var(--admin-text)]"
          aria-label="Menu"
        >
          <span className="flex h-4 w-4 flex-col justify-between">
            <span className="h-[2px] w-full rounded bg-current" />
            <span className="h-[2px] w-full rounded bg-current" />
            <span className="h-[2px] w-full rounded bg-current" />
          </span>
        </button>
        <div className="flex items-center justify-center">
          <NeuraLogo compact href="/master" />
        </div>
        <LinkToNotifications />
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-57px)] w-full max-w-[1400px] grid-cols-1 pt-[calc(57px+env(safe-area-inset-top))] lg:min-h-screen lg:grid-cols-[260px_1fr] lg:pt-0">
        <aside className="hidden border-r border-[var(--admin-border)] px-5 py-6 lg:block">
          <div className="mb-8 flex items-center justify-center">
            <NeuraLogo href="/master" />
          </div>
          <MasterNav />
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
          <NeuraLogo href="/master" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md border px-2 py-1 text-base leading-none text-[var(--admin-text)]"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <MasterNav onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>
  );
}

function LinkToNotifications() {
  return (
    <a
      href="/master/notifications"
      className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] rounded-lg border p-2 text-[var(--admin-text)]"
      aria-label="Notifications"
    >
      <BellIcon />
    </a>
  );
}
