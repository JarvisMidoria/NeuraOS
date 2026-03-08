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
    <nav className="flex flex-col items-start gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/master" ? pathname === "/master" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`liquid-pill w-[212px] max-w-full px-3 py-1.5 text-sm transition ${
              active
                ? "liquid-selected"
                : "text-[var(--admin-muted)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--admin-soft-bg))] hover:text-[var(--admin-text)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
