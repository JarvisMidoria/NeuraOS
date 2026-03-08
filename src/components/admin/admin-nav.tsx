"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { key: "overview", href: "/admin", en: "Overview", fr: "Apercu" },
  { key: "analytics", href: "/admin/analytics", en: "Analytics", fr: "Analytics" },
  { key: "notifications", href: "/admin/notifications", en: "Notifications", fr: "Notifications" },
  { key: "onboarding", href: "/admin/onboarding", en: "Onboarding", fr: "Onboarding" },
  { key: "billing", href: "/admin/billing", en: "Billing", fr: "Facturation" },
  { key: "documents", href: "/admin/documents", en: "Documents", fr: "Documents" },
  { key: "products", href: "/admin/products", en: "Products", fr: "Produits" },
  { key: "stock", href: "/admin/stock", en: "Inventory", fr: "Stock" },
  { key: "quotes", href: "/admin/sales/quotes", en: "Quotes", fr: "Devis" },
  { key: "orders", href: "/admin/sales/orders", en: "Orders", fr: "Commandes" },
  { key: "purchases", href: "/admin/purchases/orders", en: "Purchases", fr: "Achats" },
  { key: "receipts", href: "/admin/purchases/receipts", en: "Receipts", fr: "Receptions" },
  { key: "replenishment", href: "/admin/purchases/replenishment", en: "Replenishment", fr: "Reappro" },
  { key: "clients", href: "/admin/clients", en: "Clients", fr: "Clients" },
  { key: "suppliers", href: "/admin/suppliers", en: "Suppliers", fr: "Fournisseurs" },
  { key: "warehouses", href: "/admin/warehouses", en: "Warehouses", fr: "Entrepots" },
  { key: "settings", href: "/admin/settings", en: "Settings", fr: "Parametres" },
  { key: "audit", href: "/admin/audit", en: "Audit Log", fr: "Journal audit" },
] as const;

const SIMULATION_NAV_KEYS = new Set([
  "overview",
  "analytics",
  "notifications",
  "clients",
  "quotes",
  "suppliers",
]);

type AdminLang = "en" | "fr";
type AdminTheme = "dark" | "light";
type AdminNavProps = {
  onNavigate?: () => void;
};

type SearchResult = {
  id: string;
  type: "product" | "client" | "supplier" | "quote" | "order" | "purchase" | "page";
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
  const [workspaceMode, setWorkspaceMode] = useState<"LIVE" | "SIMULATION">("LIVE");
  const [canUseSimulation, setCanUseSimulation] = useState(false);
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
    page: lang === "fr" ? "Page" : "Page",
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
    const loadWorkspace = async () => {
      try {
        const response = await fetch("/api/workspace/mode", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: { mode?: "LIVE" | "SIMULATION"; canUseSimulation?: boolean } };
        if (payload.data?.mode) setWorkspaceMode(payload.data.mode);
        if (typeof payload.data?.canUseSimulation === "boolean") setCanUseSimulation(payload.data.canUseSimulation);
      } catch {
        // noop
      }
    };
    loadWorkspace();
  }, []);

  const navItems = useMemo(() => {
    if (!canUseSimulation || workspaceMode === "LIVE") return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => SIMULATION_NAV_KEYS.has(item.key));
  }, [workspaceMode, canUseSimulation]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 1) {
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
            className="liquid-input w-full px-3 py-2 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-muted)]"
          />
          {(query.trim().length >= 1 || loading) && (
            <div className="liquid-surface-strong absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 max-h-72 overflow-auto p-2">
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
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            aria-label={text.english}
            title={text.english}
            className={`liquid-pill inline-flex h-9 w-9 items-center justify-center p-0 text-[10px] ${
              lang === "en"
                ? "liquid-selected"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            {text.english}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("fr")}
            aria-label={text.french}
            title={text.french}
            className={`liquid-pill inline-flex h-9 w-9 items-center justify-center p-0 text-[10px] ${
              lang === "fr"
                ? "liquid-selected"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            {text.french}
          </button>
          <button
            type="button"
            onClick={() => setColorMode("dark")}
            aria-label={text.darkLabel}
            title={text.darkLabel}
            className={`liquid-pill inline-flex h-9 w-9 items-center justify-center p-0 text-[10px] ${
              theme === "dark"
                ? "liquid-selected"
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
            className={`liquid-pill inline-flex h-9 w-9 items-center justify-center p-0 text-[10px] ${
              theme === "light"
                ? "liquid-selected"
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

      <nav className="flex flex-col items-start gap-1 pb-4">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
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
              {lang === "fr" ? item.fr : item.en}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
