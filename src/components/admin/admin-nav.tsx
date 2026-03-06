"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", en: "Overview", fr: "Apercu" },
  { href: "/admin/products", en: "Products", fr: "Produits" },
  { href: "/admin/stock", en: "Inventory", fr: "Stock" },
  { href: "/admin/sales/quotes", en: "Quotes", fr: "Devis" },
  { href: "/admin/sales/orders", en: "Orders", fr: "Commandes" },
  { href: "/admin/purchases/orders", en: "Purchases", fr: "Achats" },
  { href: "/admin/purchases/receipts", en: "Receipts", fr: "Receptions" },
  { href: "/admin/purchases/replenishment", en: "Replenishment", fr: "Reappro" },
  { href: "/admin/suppliers", en: "Suppliers", fr: "Fournisseurs" },
  { href: "/admin/warehouses", en: "Warehouses", fr: "Entrepots" },
  { href: "/admin/settings", en: "Settings", fr: "Parametres" },
];

type AdminLang = "en" | "fr";
type AdminTheme = "dark" | "light";
type AdminNavProps = {
  onNavigate?: () => void;
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<AdminLang>(() => {
    if (typeof window === "undefined") return "en";
    const cookieLang = document.cookie.match(/(?:^|;\s*)neura_lang=([^;]+)/)?.[1];
    const localLang = window.localStorage.getItem("neura_lang");
    return (cookieLang || localLang) === "fr" ? "fr" : "en";
  });
  const [theme, setTheme] = useState<AdminTheme>(() => {
    if (typeof window === "undefined") return "dark";
    const cookieTheme = document.cookie.match(/(?:^|;\s*)neura_theme=([^;]+)/)?.[1];
    const localTheme = window.localStorage.getItem("neura_theme");
    return (cookieTheme || localTheme) === "light" ? "light" : "dark";
  });

  const text = useMemo(
    () => ({
      search: lang === "fr" ? "Rechercher..." : "Search...",
      language: lang === "fr" ? "Langue" : "Language",
      english: "EN",
      french: "FR",
      darkLabel: lang === "fr" ? "Mode nuit" : "Dark mode",
      lightLabel: lang === "fr" ? "Mode jour" : "Light mode",
    }),
    [lang],
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-admin-theme", theme);
  }, [theme]);

  const savePreference = (key: "neura_lang" | "neura_theme", value: string) => {
    document.cookie = `${key}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.localStorage.setItem(key, value);
  };

  const setLanguage = (value: AdminLang) => {
    setLang(value);
    savePreference("neura_lang", value);
    window.location.reload();
  };

  const setColorMode = (value: AdminTheme) => {
    setTheme(value);
    document.documentElement.setAttribute("data-admin-theme", value);
    savePreference("neura_theme", value);
  };

  const filteredItems = NAV_ITEMS.filter((item) => {
    const label = lang === "fr" ? item.fr : item.en;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <>
      <div className="mb-4 space-y-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text.search}
          className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`rounded-lg border px-2 py-1.5 text-xs ${
              lang === "en"
                ? "border-white/25 bg-white/12 text-zinc-100"
                : "border-white/12 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {text.language}: {text.english}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("fr")}
            className={`rounded-lg border px-2 py-1.5 text-xs ${
              lang === "fr"
                ? "border-white/25 bg-white/12 text-zinc-100"
                : "border-white/12 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {text.language}: {text.french}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setColorMode("dark")}
            aria-label={text.darkLabel}
            title={text.darkLabel}
            className={`rounded-lg border px-2 py-1.5 text-sm ${
              theme === "dark"
                ? "border-white/25 bg-white/12 text-zinc-100"
                : "border-white/12 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ☾
          </button>
          <button
            type="button"
            onClick={() => setColorMode("light")}
            aria-label={text.lightLabel}
            title={text.lightLabel}
            className={`rounded-lg border px-2 py-1.5 text-sm ${
              theme === "light"
                ? "border-white/25 bg-white/12 text-zinc-100"
                : "border-white/12 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ☀
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {filteredItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-white/12 text-zinc-100"
                  : "text-zinc-400 hover:bg-white/6 hover:text-zinc-200"
              }`}
            >
              {lang === "fr" ? item.fr : item.en}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
