import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLowStockProducts } from "@/lib/stock-service";

const FULFILLED_ORDER_STATUSES: DocumentStatus[] = [
  DocumentStatus.CONFIRMED,
  DocumentStatus.FULFILLED,
  DocumentStatus.CLOSED,
];

const OPEN_PURCHASE_STATUSES: DocumentStatus[] = [
  DocumentStatus.DRAFT,
  DocumentStatus.SENT,
  DocumentStatus.APPROVED,
  DocumentStatus.CONFIRMED,
  DocumentStatus.PARTIAL,
  DocumentStatus.PARTIALLY_RECEIVED,
];

const ACTIVE_QUOTE_STATUSES: DocumentStatus[] = [DocumentStatus.SENT, DocumentStatus.APPROVED];

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

function periodStartForMonths(months: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

function normalizeMonthInput(months?: number) {
  if (months === 3 || months === 6 || months === 12) return months;
  return 6;
}

type MonthlyRow = { month: Date; total: Prisma.Decimal };

function buildSeriesMap(rows: MonthlyRow[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(row.month.toISOString(), decimalToNumber(row.total));
  });
  return map;
}

function buildMonthSeries(months: number, salesMap: Map<string, number>, purchasesMap: Map<string, number>) {
  const now = new Date();
  const points: Array<{ iso: string; month: string; sales: number; purchases: number }> = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const iso = date.toISOString();
    points.push({
      iso,
      month: date.toLocaleString("en", { month: "short" }),
      sales: salesMap.get(iso) ?? 0,
      purchases: purchasesMap.get(iso) ?? 0,
    });
  }
  return points;
}

export type AnalyticsSnapshot = {
  months: 3 | 6 | 12;
  timestamp: string;
  metrics: {
    salesTotal: number;
    purchaseTotal: number;
    quoteSent: number;
    quoteConverted: number;
    conversionRate: number;
    openPurchaseCount: number;
  };
  monthly: Array<{ iso: string; month: string; sales: number; purchases: number }>;
  topClients: Array<{ id: string; name: string; total: number; orders: number }>;
  topProducts: Array<{ id: string; sku: string; name: string; quantity: number; revenue: number }>;
  quoteFunnel: Array<{ status: DocumentStatus; count: number }>;
  stockAlerts: {
    lowStockCount: number;
    outOfStockCount: number;
    topLowStock: Awaited<ReturnType<typeof getLowStockProducts>>;
  };
  logisticsTasks: Array<{ id: string; label: string; count: number; severity: "low" | "medium" | "high"; href: string }>;
};

export async function getAnalyticsSnapshot(companyId: string, inputMonths?: number): Promise<AnalyticsSnapshot> {
  const months = normalizeMonthInput(inputMonths) as 3 | 6 | 12;
  const now = new Date();
  const periodStart = periodStartForMonths(months);

  const [
    salesInPeriod,
    purchasesInPeriod,
    quoteFunnelRaw,
    monthlySalesRaw,
    monthlyPurchasesRaw,
    topClientsRaw,
    topProductsQtyRaw,
    lowStock,
    outOfStockRaw,
    overdueReceipts,
    approvedOrdersWaiting,
    quotesExpiringSoon,
    openPurchaseCount,
  ] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: {
        companyId,
        status: { in: FULFILLED_ORDER_STATUSES },
        orderDate: { gte: periodStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: {
        companyId,
        status: { in: OPEN_PURCHASE_STATUSES },
        orderDate: { gte: periodStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.salesQuote.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: {
        companyId,
        quoteDate: { gte: periodStart },
      },
    }),
    prisma.$queryRaw<MonthlyRow[]>`
      SELECT DATE_TRUNC('month', "orderDate") AS month,
             COALESCE(SUM("totalAmount"), 0) AS total
      FROM "SalesOrder"
      WHERE "companyId" = ${companyId}
        AND "orderDate" >= ${periodStart}
        AND "status" IN (${Prisma.join(
          FULFILLED_ORDER_STATUSES.map((status) => Prisma.sql`CAST(${status} AS "DocumentStatus")`),
        )})
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<MonthlyRow[]>`
      SELECT DATE_TRUNC('month', "orderDate") AS month,
             COALESCE(SUM("totalAmount"), 0) AS total
      FROM "PurchaseOrder"
      WHERE "companyId" = ${companyId}
        AND "orderDate" >= ${periodStart}
        AND "status" IN (${Prisma.join(
          OPEN_PURCHASE_STATUSES.map((status) => Prisma.sql`CAST(${status} AS "DocumentStatus")`),
        )})
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.salesOrder.groupBy({
      by: ["clientId"],
      where: {
        companyId,
        status: { in: FULFILLED_ORDER_STATUSES },
        orderDate: { gte: periodStart },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: {
        _sum: { totalAmount: "desc" },
      },
      take: 5,
    }),
    prisma.salesOrderLine.groupBy({
      by: ["productId"],
      where: {
        salesOrder: {
          companyId,
          status: { in: FULFILLED_ORDER_STATUSES },
          orderDate: { gte: periodStart },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: {
        _sum: { lineTotal: "desc" },
      },
      take: 5,
    }),
    getLowStockProducts(companyId),
    prisma.$queryRaw<Array<{ productId: string }>>`
      SELECT p.id AS "productId"
      FROM "Product" p
      LEFT JOIN (
        SELECT "productId", COALESCE(SUM(
          CASE
            WHEN "movementType" = 'OUTBOUND'::"StockMovementType" THEN -"quantity"
            ELSE "quantity"
          END
        ), 0) AS stock
        FROM "StockMovement"
        WHERE "companyId" = ${companyId}
        GROUP BY "productId"
      ) sm ON sm."productId" = p.id
      WHERE p."companyId" = ${companyId}
        AND COALESCE(sm.stock, 0) <= 0
    `,
    prisma.purchaseOrder.count({
      where: {
        companyId,
        status: { in: OPEN_PURCHASE_STATUSES },
        expectedDate: { lt: now },
      },
    }),
    prisma.salesOrder.count({
      where: {
        companyId,
        status: DocumentStatus.APPROVED,
        confirmedAt: null,
      },
    }),
    prisma.salesQuote.count({
      where: {
        companyId,
        status: { in: ACTIVE_QUOTE_STATUSES },
        validUntil: { not: null, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        companyId,
        status: { in: OPEN_PURCHASE_STATUSES },
      },
    }),
  ]);

  const clientIds = topClientsRaw.map((row) => row.clientId);
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { companyId, id: { in: clientIds } },
        select: { id: true, name: true },
      })
    : [];
  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));

  const productIds = topProductsQtyRaw.map((row) => row.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true, sku: true, name: true },
      })
    : [];
  const productById = new Map(products.map((product) => [product.id, product]));

  const salesMap = buildSeriesMap(monthlySalesRaw);
  const purchasesMap = buildSeriesMap(monthlyPurchasesRaw);
  const monthly = buildMonthSeries(months, salesMap, purchasesMap);

  const sentCount = quoteFunnelRaw
    .filter((row) => ACTIVE_QUOTE_STATUSES.includes(row.status as DocumentStatus))
    .reduce((acc, row) => acc + row._count._all, 0);
  const convertedCount = quoteFunnelRaw
    .filter((row) => row.status === DocumentStatus.CONVERTED)
    .reduce((acc, row) => acc + row._count._all, 0);

  return {
    months,
    timestamp: now.toISOString(),
    metrics: {
      salesTotal: decimalToNumber(salesInPeriod._sum.totalAmount),
      purchaseTotal: decimalToNumber(purchasesInPeriod._sum.totalAmount),
      quoteSent: sentCount,
      quoteConverted: convertedCount,
      conversionRate: sentCount === 0 ? 0 : Number(((convertedCount / sentCount) * 100).toFixed(1)),
      openPurchaseCount,
    },
    monthly,
    topClients: topClientsRaw.map((row) => ({
      id: row.clientId,
      name: clientNameById.get(row.clientId) ?? "Unknown client",
      total: decimalToNumber(row._sum.totalAmount),
      orders: row._count._all,
    })),
    topProducts: topProductsQtyRaw
      .map((row) => {
        const product = productById.get(row.productId);
        if (!product) return null;
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          quantity: decimalToNumber(row._sum.quantity),
          revenue: decimalToNumber(row._sum.lineTotal),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    quoteFunnel: quoteFunnelRaw
      .map((row) => ({ status: row.status, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    stockAlerts: {
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStockRaw.length,
      topLowStock: lowStock.slice(0, 6),
    },
    logisticsTasks: [
      {
        id: "quotes-expiring",
        label: "Quotes expiring in 7 days",
        count: quotesExpiringSoon,
        severity: quotesExpiringSoon > 5 ? "high" : quotesExpiringSoon > 0 ? "medium" : "low",
        href: "/admin/sales/quotes",
      },
      {
        id: "orders-awaiting-confirmation",
        label: "Orders awaiting confirmation",
        count: approvedOrdersWaiting,
        severity: approvedOrdersWaiting > 3 ? "high" : approvedOrdersWaiting > 0 ? "medium" : "low",
        href: "/admin/sales/orders",
      },
      {
        id: "late-receipts",
        label: "Late purchase receipts",
        count: overdueReceipts,
        severity: overdueReceipts > 0 ? "high" : "low",
        href: "/admin/purchases/receipts",
      },
    ],
  };
}
