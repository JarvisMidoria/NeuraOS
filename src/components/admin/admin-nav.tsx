"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", en: "Overview", fr: "Apercu" },
  { href: "/admin/analytics", en: "Analytics", fr: "Analytics" },
  { href: "/admin/notifications", en: "Notifications", fr: "Notifications" },
  { href: "/admin/onboarding", en: "Onboarding", fr: "Onboarding" },
  { href: "/admin/billing", en: "Billing", fr: "Facturation" },
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
  { href: "/admin/saas", en: "SaaS", fr: "SaaS" },
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
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-input-bg)] px-3 py-2 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-muted)]"
          />
          {(query.trim().length >= 2 || loading) && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-72 overflow-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 shadow-2xl">
              {loading && <p className="px-2 py-1.5 text-xs text-[var(--admin-muted)]">{text.loading}</p>}
              {!loading && results.length === 0 && <p className="px-2 py-1.5 text-xs text-[var(--admin-muted)]">{text.noResults}</p>}
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
                    className="block rounded-md px-2 py-2 transition hover:bg-[var(--admin-soft-bg)]"
                  >
                    <p className="text-sm font-medium text-[var(--admin-text)]">{result.title}</p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {typeLabels[result.type]} · {result.subtitle}
                    </p>
                  </Link>
                ))}
            </div>
          )}
          {query.trim().length < 2 && <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{text.searchHint}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`rounded-full border border-[var(--admin-border)] px-2 py-1 text-[10px] ${
              lang === "en"
                ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            {text.english}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("fr")}
            className={`rounded-full border border-[var(--admin-border)] px-2 py-1 text-[10px] ${
              lang === "fr"
                ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            {text.french}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setColorMode("dark")}
            aria-label={text.darkLabel}
            title={text.darkLabel}
            className={`inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-2 py-1 text-[10px] ${
              theme === "dark"
                ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
              <path d="M18 15.5A7.5 7.5 0 1 1 8.5 6a6.5 6.5 0 1 0 9.5 9.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setColorMode("light")}
            aria-label={text.lightLabel}
            title={text.lightLabel}
            className={`inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-2 py-1 text-[10px] ${
              theme === "light"
                ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.5V5" />
              <path d="M12 19V21.5" />
              <path d="M2.5 12H5" />
              <path d="M19 12H21.5" />
              <path d="m4.9 4.9 1.8 1.8" />
              <path d="m17.3 17.3 1.8 1.8" />
              <path d="m17.3 6.7 1.8-1.8" />
              <path d="m4.9 19.1 1.8-1.8" />
            </svg>
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
                  ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                  : "text-[var(--admin-muted)] hover:bg-[var(--admin-soft-bg)] hover:text-[var(--admin-text)]"
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
