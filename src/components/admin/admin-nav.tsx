"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", en: "Overview", fr: "Apercu" },
  { href: "/admin/analytics", en: "Analytics", fr: "Analytics" },
  { href: "/admin/notifications", en: "Notifications", fr: "Notifications" },
  { href: "/admin/documents", en: "Documents", fr: "Documents" },
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
  { href: "/admin/audit", en: "Audit Log", fr: "Journal audit" },
];

type AdminLang = "en" | "fr";
type AdminTheme = "dark" | "light";
type AdminNavProps = {
  onNavigate?: () => void;
};

type SearchResult = {
  id: string;
  type: "product" | "client" | "supplier" | "quote" | "order" | "purchase";
  title: string;
  subtitle: string;
  href: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
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
      search: lang === "fr" ? "Recherche globale..." : "Global search...",
      searchHint: lang === "fr" ? "Produits, clients, devis, commandes..." : "Products, clients, quotes, orders...",
      noResults: lang === "fr" ? "Aucun resultat" : "No results",
      loading: lang === "fr" ? "Recherche..." : "Searching...",
      language: lang === "fr" ? "Langue" : "Language",
      english: "EN",
      french: "FR",
      darkLabel: lang === "fr" ? "Mode nuit" : "Dark mode",
      lightLabel: lang === "fr" ? "Mode jour" : "Light mode",
    }),
    [lang],
  );

  const typeLabels: Record<SearchResult["type"], string> = {
    product: lang === "fr" ? "Produit" : "Product",
    client: lang === "fr" ? "Client" : "Client",
    supplier: lang === "fr" ? "Fournisseur" : "Supplier",
    quote: lang === "fr" ? "Devis" : "Quote",
    order: lang === "fr" ? "Commande" : "Order",
    purchase: lang === "fr" ? "Achat" : "Purchase",
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-admin-theme", theme);
  }, [theme]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/search/global?query=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: SearchResult[] };
        setResults(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

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

  return (
    <>
      <div className="mb-4 space-y-3">
        <div className="relative">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.search}
            className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
          {(query.trim().length >= 2 || loading) && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-72 overflow-auto rounded-lg border border-white/15 bg-[#0a0f1d] p-2 shadow-2xl">
              {loading && <p className="px-2 py-1.5 text-xs text-zinc-400">{text.loading}</p>}
              {!loading && results.length === 0 && <p className="px-2 py-1.5 text-xs text-zinc-400">{text.noResults}</p>}
              {!loading &&
                results.map((result) => (
                  <Link
                    key={result.id}
                    href={result.href}
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                      onNavigate?.();
                    }}
                    className="block rounded-md px-2 py-2 transition hover:bg-white/10"
                  >
                    <p className="text-sm font-medium text-zinc-100">{result.title}</p>
                    <p className="text-xs text-zinc-400">
                      {typeLabels[result.type]} · {result.subtitle}
                    </p>
                  </Link>
                ))}
            </div>
          )}
          {query.trim().length < 2 && <p className="mt-1 text-[11px] text-zinc-500">{text.searchHint}</p>}
        </div>

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
        {NAV_ITEMS.map((item) => {
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
