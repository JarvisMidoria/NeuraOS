"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceModeToggle } from "@/components/admin/workspace-mode-toggle";

type NavSectionKey = "home" | "sales" | "operations" | "admin";

const SECTION_ORDER: NavSectionKey[] = ["home", "sales", "operations", "admin"];

const NAV_ITEMS = [
  { key: "overview", href: "/admin", en: "Overview", fr: "Apercu", section: "home" as const },
  { key: "analytics", href: "/admin/analytics", en: "Performance", fr: "Performance", section: "home" as const },
  { key: "notifications", href: "/admin/notifications", en: "Alerts", fr: "Alertes", section: "home" as const },
  { key: "quotes", href: "/admin/sales/quotes", en: "Quotes", fr: "Devis", section: "sales" as const },
  { key: "orders", href: "/admin/sales/orders", en: "Orders", fr: "Commandes", section: "sales" as const },
  { key: "clients", href: "/admin/clients", en: "Clients", fr: "Clients", section: "sales" as const },
  { key: "documents", href: "/admin/documents", en: "Documents", fr: "Documents", section: "sales" as const },
  { key: "stock", href: "/admin/stock", en: "Stock", fr: "Stock", section: "operations" as const },
  { key: "products", href: "/admin/products", en: "Products", fr: "Produits", section: "operations" as const },
  { key: "purchases", href: "/admin/purchases/orders", en: "Purchases", fr: "Achats", section: "operations" as const },
  { key: "receipts", href: "/admin/purchases/receipts", en: "Receipts", fr: "Receptions", section: "operations" as const },
  { key: "suppliers", href: "/admin/suppliers", en: "Suppliers", fr: "Fournisseurs", section: "operations" as const },
  { key: "warehouses", href: "/admin/warehouses", en: "Warehouses", fr: "Entrepots", section: "operations" as const },
  { key: "replenishment", href: "/admin/purchases/replenishment", en: "Restock", fr: "Reappro", section: "operations" as const },
  { key: "imports", href: "/admin/imports", en: "Import center", fr: "Centre import", section: "admin" as const },
  { key: "billing", href: "/admin/billing", en: "Subscription", fr: "Abonnement", section: "admin" as const },
  { key: "settings", href: "/admin/settings", en: "Company", fr: "Entreprise", section: "admin" as const },
  { key: "audit", href: "/admin/audit", en: "Activity log", fr: "Historique", section: "admin" as const },
  { key: "onboarding", href: "/admin/onboarding", en: "Setup", fr: "Mise en place", section: "admin" as const },
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
  const [companyName, setCompanyName] = useState("Tenant");
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
      logout: lang === "fr" ? "Deconnexion" : "Log out",
      groups: {
        home: lang === "fr" ? "Essentiel" : "Home",
        sales: lang === "fr" ? "Ventes" : "Sales",
        operations: lang === "fr" ? "Operations" : "Operations",
        admin: lang === "fr" ? "Administration" : "Admin",
      } as Record<NavSectionKey, string>,
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
    const loadCompany = async () => {
      try {
        const response = await fetch("/api/settings/company", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: { name?: string } };
        const resolvedName = String(payload.data?.name ?? "").trim();
        if (resolvedName) setCompanyName(resolvedName);
      } catch {
        // noop
      }
    };
    loadCompany();
  }, []);

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

  const navSections = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        section,
        items: navItems.filter((item) => item.section === section),
      })).filter((group) => group.items.length > 0),
    [navItems],
  );

  const [expandedSection, setExpandedSection] = useState<NavSectionKey | null>(null);

  useEffect(() => {
    const sectionWithActive = navSections.find((group) => group.items.some((item) => isActive(pathname, item.href)))?.section ?? null;
    setExpandedSection((current) => {
      if (sectionWithActive) return sectionWithActive;
      if (current && navSections.some((group) => group.section === current)) return current;
      return navSections[0]?.section ?? null;
    });
  }, [navSections, pathname]);

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
    <div className="admin-nav-layout flex h-full min-h-0 flex-col">
      <div className="admin-nav-header">
        <div className="text-center">
          <p className="break-words text-3xl font-semibold tracking-tight text-[var(--admin-text)]">{companyName}</p>
          <p className="mt-1 text-[11px] text-[var(--admin-muted)]">Powered by NeuraOS</p>
        </div>

        <div className="relative mt-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.search}
            className="liquid-input w-full px-3 py-2 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-muted)]"
          />
          {(query.trim().length >= 1 || loading) && (
            <div className="liquid-surface-strong absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 max-h-72 overflow-auto p-2">
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
      </div>

      <nav className="admin-nav-scroll mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
        {navSections.map((group) => {
          const open = expandedSection === group.section;
          const hasActive = group.items.some((item) => isActive(pathname, item.href));
          return (
            <section key={group.section} className="admin-nav-group">
              <button
                type="button"
                className={`admin-nav-group-toggle ${hasActive ? "is-active" : ""}`}
                onClick={() => setExpandedSection((current) => (current === group.section ? null : group.section))}
                aria-expanded={open}
              >
                <span>{text.groups[group.section]}</span>
                <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m5 8 5 5 5-5" />
                </svg>
              </button>

              {open ? (
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`admin-nav-item ${active ? "is-active" : ""}`}
                      >
                        {lang === "fr" ? item.fr : item.en}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>

      <div className="admin-nav-footer mt-5 border-t border-[var(--admin-border)] pt-4">
        <div className="flex items-center gap-2">
          <WorkspaceModeToggle lang={lang} />
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="admin-nav-logout-btn"
          >
            {text.logout}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            aria-label={text.english}
            title={text.english}
            className={`admin-nav-circle-btn ${lang === "en" ? "is-active" : ""}`}
          >
            {text.english}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("fr")}
            aria-label={text.french}
            title={text.french}
            className={`admin-nav-circle-btn ${lang === "fr" ? "is-active" : ""}`}
          >
            {text.french}
          </button>
          <button
            type="button"
            onClick={() => setColorMode("dark")}
            aria-label={text.darkLabel}
            title={text.darkLabel}
            className={`admin-nav-circle-btn ${theme === "dark" ? "is-active" : ""}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
              <path d="M18 15.5A7.5 7.5 0 1 1 8.5 6a6.5 6.5 0 1 0 9.5 9.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setColorMode("light")}
            aria-label={text.lightLabel}
            title={text.lightLabel}
            className={`admin-nav-circle-btn ${theme === "light" ? "is-active" : ""}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
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
    </div>
  );
}
