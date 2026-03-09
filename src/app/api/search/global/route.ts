import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleApiError, requireSession } from "@/lib/api-helpers";
import { perfLog, perfNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";

type SearchItemType = "product" | "client" | "supplier" | "quote" | "order" | "purchase" | "page";

type SearchItem = {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle: string;
  href: string;
  score: number;
};

const PAGE_SUGGESTIONS: Array<{
  id: string;
  type: SearchItemType;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
}> = [
  { id: "page-overview", type: "page", title: "Overview", subtitle: "Company dashboard", href: "/admin", keywords: ["overview", "dashboard", "home", "apercu"] },
  { id: "page-analytics", type: "page", title: "Analytics", subtitle: "Performance and trends", href: "/admin/analytics", keywords: ["analytics", "report", "kpi", "stats"] },
  { id: "page-notifications", type: "page", title: "Notifications", subtitle: "Alerts and reminders", href: "/admin/notifications", keywords: ["notifications", "alert", "alerts", "notif"] },
  { id: "page-clients", type: "page", title: "Clients", subtitle: "Customer directory", href: "/admin/clients", keywords: ["client", "clients", "customer", "customers"] },
  { id: "page-products", type: "page", title: "Products", subtitle: "Catalog and product setup", href: "/admin/products", keywords: ["product", "products", "prod", "catalog", "production"] },
  { id: "page-stock", type: "page", title: "Inventory", subtitle: "Stock and warehouse operations", href: "/admin/stock", keywords: ["stock", "inventory", "warehouse", "entrepot", "production"] },
  { id: "page-quotes", type: "page", title: "Quotes", subtitle: "Sales quotes and conversion", href: "/admin/sales/quotes", keywords: ["quote", "quotes", "devis", "proposal", "sales"] },
  { id: "page-orders", type: "page", title: "Orders", subtitle: "Sales orders and fulfilment", href: "/admin/sales/orders", keywords: ["order", "orders", "commande", "commandes", "fulfilment"] },
  { id: "page-purchases", type: "page", title: "Purchases", subtitle: "Purchase orders and receipts", href: "/admin/purchases/orders", keywords: ["purchase", "purchases", "procurement", "achat", "po"] },
  { id: "page-suppliers", type: "page", title: "Suppliers", subtitle: "Supplier management", href: "/admin/suppliers", keywords: ["supplier", "suppliers", "vendor", "fournisseur"] },
  { id: "page-documents", type: "page", title: "Documents", subtitle: "Quotes, orders and PDFs", href: "/admin/documents", keywords: ["documents", "document", "pdf", "invoice"] },
  { id: "page-hr", type: "page", title: "Core HR", subtitle: "Employee base and org structure", href: "/admin/hr", keywords: ["hr", "human resources", "employee", "employees", "rh"] },
  { id: "page-hr-employees", type: "page", title: "HR Employees", subtitle: "Employee records", href: "/admin/hr/employees", keywords: ["employee", "employees", "staff", "team", "salarie"] },
  { id: "page-hr-structure", type: "page", title: "HR Structure", subtitle: "Departments, entities, locations", href: "/admin/hr/structure", keywords: ["department", "entity", "position", "location", "org"] },
  { id: "page-hr-imports", type: "page", title: "HR Imports", subtitle: "HR onboarding import center", href: "/admin/hr/imports", keywords: ["hr import", "import rh", "employee import", "onboarding rh"] },
];

const TYPE_KEYWORDS: Record<SearchItemType, string[]> = {
  product: ["product", "products", "prod", "production", "sku", "catalog", "item"],
  client: ["client", "clients", "customer", "customers", "crm"],
  supplier: ["supplier", "suppliers", "vendor", "vendors", "fournisseur", "achat"],
  quote: ["quote", "quotes", "devis", "proposal", "rfq"],
  order: ["order", "orders", "commande", "commandes", "so", "sales"],
  purchase: ["purchase", "purchases", "procurement", "po", "achat", "achats"],
  page: ["page", "section", "go", "open"],
};

function clampQuery(raw: string) {
  return raw.trim().slice(0, 80);
}

function toInt(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseTerms(query: string) {
  const normalized = normalize(query);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return Array.from(new Set([normalized, ...terms])).slice(0, 6);
}

function scoreText(value: string, query: string) {
  const text = normalize(value);
  if (!text) return 0;
  if (text === query) return 120;
  if (text.startsWith(query)) return 90;
  if (text.includes(query)) return 48;
  const words = text.split(/\s+/);
  if (words.some((word) => word.startsWith(query))) return 40;
  return 0;
}

function scoreTypeHint(type: SearchItemType, query: string) {
  const words = TYPE_KEYWORDS[type] ?? [];
  let score = 0;
  for (const keyword of words) {
    if (keyword === query) score = Math.max(score, 55);
    else if (keyword.startsWith(query)) score = Math.max(score, 35);
  }
  return score;
}

function rankItem(item: Omit<SearchItem, "score">, query: string) {
  return (
    scoreText(item.title, query) +
    Math.floor(scoreText(item.subtitle, query) * 0.65) +
    scoreTypeHint(item.type, query)
  );
}

export async function GET(req: NextRequest) {
  const startedAt = perfNow();
  try {
    const session = await requireSession();

    const url = new URL(req.url);
    const query = clampQuery(url.searchParams.get("query") ?? "");
    if (query.length < 1) {
      return NextResponse.json({ data: [] });
    }

    const companyId = session.user.companyId;
    const isSimulation = session.user.workspaceMode === "SIMULATION";
    const maybeNumber = toInt(query);
    const permissions = new Set(session.user.permissions ?? []);
    const canSeeDashboard = permissions.has("VIEW_DASHBOARD");
    const canManageProducts = permissions.has("MANAGE_PRODUCTS");
    const canManageWarehouse = permissions.has("MANAGE_WAREHOUSE");
    const canManageSales = permissions.has("MANAGE_SALES");
    const canManagePurchasing = permissions.has("MANAGE_PURCHASING");
    const canAccessHr = permissions.has("ADMIN") || permissions.has("HR_ADMIN") || permissions.has("HR_MANAGER") || permissions.has("HR_EMPLOYEE");
    const canReadSimulationCore = isSimulation && (canManageSales || canManagePurchasing || canSeeDashboard);

    const terms = parseTerms(query);
    const normalizedQuery = normalize(query);

    const productWhere =
      isSimulation
        ? null
        :
      canManageProducts || canManageWarehouse
        ? {
            companyId,
            OR: terms.flatMap((term) => [
              { sku: { contains: term, mode: "insensitive" as const } },
              { name: { contains: term, mode: "insensitive" as const } },
            ]),
          }
        : null;

    const clientWhere =
      canManageSales || canSeeDashboard
        ? {
            companyId,
            OR: terms.flatMap((term) => [
              { name: { contains: term, mode: "insensitive" as const } },
              { email: { contains: term, mode: "insensitive" as const } },
            ]),
          }
        : null;

    const supplierWhere =
      canManagePurchasing || canSeeDashboard
        ? {
            companyId,
            OR: terms.flatMap((term) => [
              { name: { contains: term, mode: "insensitive" as const } },
              { email: { contains: term, mode: "insensitive" as const } },
            ]),
          }
        : null;

    const quoteWhere =
      canManageSales || canSeeDashboard
        ? {
            companyId,
            OR: [
              ...(maybeNumber !== null ? [{ quoteNumber: maybeNumber }] : []),
              ...terms.map((term) => ({ client: { name: { contains: term, mode: "insensitive" as const } } })),
            ],
          }
        : null;

    const orderWhere =
      isSimulation
        ? null
        :
      canManageSales || canSeeDashboard
        ? {
            companyId,
            OR: [
              ...(maybeNumber !== null ? [{ orderNumber: maybeNumber }] : []),
              ...terms.map((term) => ({ client: { name: { contains: term, mode: "insensitive" as const } } })),
            ],
          }
        : null;

    const purchaseWhere =
      isSimulation
        ? null
        :
      canManagePurchasing || canSeeDashboard
        ? {
            companyId,
            OR: [
              ...(maybeNumber !== null ? [{ poNumber: maybeNumber }] : []),
              ...terms.map((term) => ({ supplier: { name: { contains: term, mode: "insensitive" as const } } })),
            ],
          }
        : null;

    const [products, clients, suppliers, quotes, orders, purchases] = await Promise.all([
      productWhere
        ? prisma.product.findMany({
            where: productWhere,
            select: { id: true, sku: true, name: true },
            take: 8,
          })
        : Promise.resolve([]),
      clientWhere
        ? prisma.client.findMany({
            where: clientWhere,
            select: { id: true, name: true, email: true },
            take: 8,
          })
        : Promise.resolve([]),
      supplierWhere
        ? prisma.supplier.findMany({
            where: supplierWhere,
            select: { id: true, name: true, email: true },
            take: 8,
          })
        : Promise.resolve([]),
      quoteWhere
        ? prisma.salesQuote.findMany({
            where: quoteWhere,
            select: {
              id: true,
              quoteNumber: true,
              client: { select: { name: true } },
            },
            take: 8,
            orderBy: { quoteDate: "desc" },
          })
        : Promise.resolve([]),
      orderWhere
        ? prisma.salesOrder.findMany({
            where: orderWhere,
            select: {
              id: true,
              orderNumber: true,
              client: { select: { name: true } },
            },
            take: 8,
            orderBy: { orderDate: "desc" },
          })
        : Promise.resolve([]),
      purchaseWhere
        ? prisma.purchaseOrder.findMany({
            where: purchaseWhere,
            select: {
              id: true,
              poNumber: true,
              supplier: { select: { name: true } },
            },
            take: 8,
            orderBy: { orderDate: "desc" },
          })
        : Promise.resolve([]),
    ]);

    const pageSuggestions = PAGE_SUGGESTIONS.filter((page) => {
      if (isSimulation) {
        const allowedSimulationPages = new Set([
          "/admin",
          "/admin/analytics",
          "/admin/notifications",
          "/admin/clients",
          "/admin/sales/quotes",
          "/admin/suppliers",
        ]);
        if (!allowedSimulationPages.has(page.href)) return false;
      }
      if (page.href.includes("/products") && !(canManageProducts || canManageWarehouse || canSeeDashboard)) return false;
      if (page.href.includes("/stock") && !(canManageWarehouse || canSeeDashboard)) return false;
      if (page.href.includes("/sales") && !(canManageSales || canSeeDashboard)) return false;
      if (page.href.includes("/purchases") && !(canManagePurchasing || canSeeDashboard)) return false;
      if (page.href.includes("/suppliers") && !(canManagePurchasing || canSeeDashboard)) return false;
      if (page.href.includes("/clients") && !canReadSimulationCore && !(canManageSales || canSeeDashboard)) return false;
      if (page.href.includes("/admin/hr") && !canAccessHr) return false;
      return page.keywords.some((keyword) => keyword.startsWith(normalizedQuery) || keyword.includes(normalizedQuery));
    });

    const candidates: Array<Omit<SearchItem, "score">> = [
      ...pageSuggestions.map((page) => ({
        id: page.id,
        type: page.type,
        title: page.title,
        subtitle: page.subtitle,
        href: page.href,
      })),
      ...products.map((item) => ({
        id: `product-${item.id}`,
        type: "product" as const,
        title: `${item.sku} · ${item.name}`,
        subtitle: "Product",
        href: "/admin/products",
      })),
      ...clients.map((item) => ({
        id: `client-${item.id}`,
        type: "client" as const,
        title: item.name,
        subtitle: item.email ?? "Client",
        href: "/admin/clients",
      })),
      ...suppliers.map((item) => ({
        id: `supplier-${item.id}`,
        type: "supplier" as const,
        title: item.name,
        subtitle: item.email ?? "Supplier",
        href: "/admin/suppliers",
      })),
      ...quotes.map((item) => ({
        id: `quote-${item.id}`,
        type: "quote" as const,
        title: `Q-${item.quoteNumber.toString().padStart(4, "0")}`,
        subtitle: item.client.name,
        href: "/admin/sales/quotes",
      })),
      ...(isSimulation
        ? []
        : orders.map((item) => ({
            id: `order-${item.id}`,
            type: "order" as const,
            title: `SO-${item.orderNumber.toString().padStart(4, "0")}`,
            subtitle: item.client.name,
            href: "/admin/sales/orders",
          }))),
      ...(isSimulation
        ? []
        : purchases.map((item) => ({
            id: `po-${item.id}`,
            type: "purchase" as const,
            title: `PO-${item.poNumber.toString().padStart(4, "0")}`,
            subtitle: item.supplier.name,
            href: "/admin/purchases/orders",
          }))),
    ];

    const deduped = new Map<string, SearchItem>();
    for (const item of candidates) {
      const score = rankItem(item, normalizedQuery);
      if (score <= 0) continue;
      const existing = deduped.get(item.id);
      if (!existing || score > existing.score) {
        deduped.set(item.id, { ...item, score });
      }
    }

    const data = [...deduped.values()]
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 24)
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
      }));

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  } finally {
    perfLog("api.search.global.GET", startedAt, 350);
  }
}
