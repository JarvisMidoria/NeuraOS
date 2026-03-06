"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/master", label: "Dashboard" },
  { href: "/master/clients", label: "Clients" },
  { href: "/master/notifications", label: "Notifications" },
];

export function MasterNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/master" ? pathname === "/master" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                : "text-[var(--admin-muted)] hover:bg-[var(--admin-soft-bg)] hover:text-[var(--admin-text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
