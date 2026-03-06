import { DocumentStatus, Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getLowStockProducts } from "@/lib/stock-service";

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

function calculateDelta(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return { deltaPct: 0, trend: "flat" as const };
    return { deltaPct: 100, trend: "up" as const };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    deltaPct: Number(change.toFixed(1)),
    trend: change > 1 ? ("up" as const) : change < -1 ? ("down" as const) : ("flat" as const),
  };
}

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

export type DashboardSnapshot = {
  timestamp: string;
  kpis: Array<{
    id: string;
    label: string;
    value: number;
    formatter: "currency" | "number" | "percent";
    deltaPct: number;
    trend: "up" | "down" | "flat";
    helper?: string;
  }>;
  monthlySales: Array<{ month: string; total: number; iso: string }>;
  lowStock: Awaited<ReturnType<typeof getLowStockProducts>>;
  latestDocuments: Array<{
    id: string;
    type: "Sales Order" | "Sales Quote" | "Purchase Order";
    code: string;
    counterpart: string;
    status: DocumentStatus;
    total: number | null;
    date: string;
    href: string;
  }>;
  operationalTodo: Array<{
    id: string;
    label: string;
    count: number;
    severity: "low" | "medium" | "high";
    description: string;
    href: string;
  }>;
};

export async function getDashboardSnapshot(companyId: string): Promise<DashboardSnapshot> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const endOfPrevMonth = new Date(startOfMonth.getTime() - 1);

  const last30DaysStart = new Date(now);
  last30DaysStart.setUTCDate(now.getUTCDate() - 30);
  const prevWindowStart = new Date(last30DaysStart);
  prevWindowStart.setUTCDate(last30DaysStart.getUTCDate() - 30);
  const prevWindowEnd = new Date(last30DaysStart.getTime() - 1);

  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [
    salesCurrent,
    salesPrevious,
    avgOrderCurrent,
    avgOrderPrevious,
    quoteWindow,
    quotePrevWindow,
    openPoCurrent,
    openPoPrevious,
    monthlySalesRaw,
    lowStock,
    latestSalesOrders,
    latestQuotes,
    latestPurchaseOrders,
    quotesExpiringSoon,
    ordersAwaitingConfirmation,
    receiptsOverdue,
  ] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: {
        companyId,
        status: { in: FULFILLED_ORDER_STATUSES },
        orderDate: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.aggregate({
      where: {
        companyId,
        status: { in: FULFILLED_ORDER_STATUSES },
        orderDate: {
          gte: startOfPrevMonth,
          lte: endOfPrevMonth,
        },
      },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.aggregate({
      where: {
        companyId,
        status: { in: FULFILLED_ORDER_STATUSES },
        orderDate: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.salesOrder.aggregate({
      where: {
        companyId,
        status: { in: FULFILLED_ORDER_STATUSES },
        orderDate: { gte: startOfPrevMonth, lte: endOfPrevMonth },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.salesQuote.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: {
        companyId,
        quoteDate: { gte: last30DaysStart },
        status: { in: [...ACTIVE_QUOTE_STATUSES, DocumentStatus.CONVERTED] },
      },
    }),
    prisma.salesQuote.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: {
        companyId,
        quoteDate: { gte: prevWindowStart, lte: prevWindowEnd },
        status: { in: [...ACTIVE_QUOTE_STATUSES, DocumentStatus.CONVERTED] },
      },
    }),
    prisma.purchaseOrder.aggregate({
      where: {
        companyId,
        status: { in: OPEN_PURCHASE_STATUSES },
        orderDate: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: {
        companyId,
        status: { in: OPEN_PURCHASE_STATUSES },
        orderDate: { gte: startOfPrevMonth, lte: endOfPrevMonth },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ month: Date; total: Prisma.Decimal }>>`
      SELECT DATE_TRUNC('month', "orderDate") AS month,
             COALESCE(SUM("totalAmount"), 0) AS total
      FROM "SalesOrder"
      WHERE "companyId" = ${companyId}
        AND "orderDate" >= ${sixMonthsAgo}
        AND "status" IN (${Prisma.join(
          FULFILLED_ORDER_STATUSES.map((status) => Prisma.sql`CAST(${status} AS "DocumentStatus")`),
        )})
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    getLowStockProducts(companyId),
    prisma.salesOrder.findMany({
      where: { companyId },
      orderBy: { orderDate: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        client: { select: { name: true } },
        status: true,
        totalAmount: true,
        orderDate: true,
      },
    }),
    prisma.salesQuote.findMany({
      where: { companyId },
      orderBy: { quoteDate: "desc" },
      take: 5,
      select: {
        id: true,
        quoteNumber: true,
        client: { select: { name: true } },
        status: true,
        totalAmount: true,
        quoteDate: true,
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId },
      orderBy: { orderDate: "desc" },
      take: 5,
      select: {
        id: true,
        poNumber: true,
        supplier: { select: { name: true } },
        status: true,
        totalAmount: true,
        orderDate: true,
      },
    }),
    prisma.salesQuote.count({
      where: {
        companyId,
        status: { in: ACTIVE_QUOTE_STATUSES },
        validUntil: { not: null, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.salesOrder.count({
      where: {
        companyId,
        status: { in: [DocumentStatus.APPROVED] },
        confirmedAt: null,
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        companyId,
        status: { in: OPEN_PURCHASE_STATUSES },
        expectedDate: { lt: now },
      },
    }),
  ]);

  const monthlyDataMap = new Map<string, number>();
  monthlySalesRaw.forEach((row) => {
    const iso = row.month.toISOString();
    monthlyDataMap.set(iso, decimalToNumber(row.total));
  });

  const monthlySales: DashboardSnapshot["monthlySales"] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const iso = date.toISOString();
    const value = monthlyDataMap.get(iso) ?? 0;
    monthlySales.push({
      iso,
      total: value,
      month: date.toLocaleString("en", { month: "short" }),
    });
  }

  const salesMtdValue = decimalToNumber(salesCurrent._sum.totalAmount);
  const salesPrevValue = decimalToNumber(salesPrevious._sum?.totalAmount ?? null);
  const salesDelta = calculateDelta(salesMtdValue, salesPrevValue);

  const avgOrderMtd =
    avgOrderCurrent._count._all === 0
      ? 0
      : decimalToNumber(avgOrderCurrent._sum.totalAmount) / avgOrderCurrent._count._all;
  const avgOrderPrev =
    avgOrderPrevious._count._all === 0
      ? 0
      : decimalToNumber(avgOrderPrevious._sum.totalAmount) / avgOrderPrevious._count._all;
  const avgOrderDelta = calculateDelta(avgOrderMtd, avgOrderPrev);

  const currentSent = quoteWindow
    .filter((row) => ACTIVE_QUOTE_STATUSES.includes(row.status as DocumentStatus))
    .reduce((acc, row) => acc + row._count._all, 0);
  const currentConverted = quoteWindow
    .filter((row) => row.status === DocumentStatus.CONVERTED)
    .reduce((acc, row) => acc + row._count._all, 0);
  const prevSent = quotePrevWindow
    .filter((row) => ACTIVE_QUOTE_STATUSES.includes(row.status as DocumentStatus))
    .reduce((acc, row) => acc + row._count._all, 0);
  const prevConverted = quotePrevWindow
    .filter((row) => row.status === DocumentStatus.CONVERTED)
    .reduce((acc, row) => acc + row._count._all, 0);

  const quoteRateCurrent = currentSent === 0 ? 0 : (currentConverted / currentSent) * 100;
  const quoteRatePrev = prevSent === 0 ? 0 : (prevConverted / prevSent) * 100;
  const quoteRateDelta = calculateDelta(quoteRateCurrent, quoteRatePrev);

  const openPoValue = decimalToNumber(openPoCurrent._sum.totalAmount);
  const openPoPrevValue = decimalToNumber(openPoPrevious._sum.totalAmount);
  const openPoDelta = calculateDelta(openPoValue, openPoPrevValue);

  const latestDocuments = [
    ...latestSalesOrders.map((order) => ({
      id: order.id,
      type: "Sales Order" as const,
      code: `SO-${order.orderNumber.toString().padStart(4, "0")}`,
      counterpart: order.client?.name ?? "—",
      status: order.status,
      total: decimalToNumber(order.totalAmount),
      date: order.orderDate.toISOString(),
      href: `/admin/sales/orders`,
    })),
    ...latestQuotes.map((quote) => ({
      id: quote.id,
      type: "Sales Quote" as const,
      code: `Q-${quote.quoteNumber.toString().padStart(4, "0")}`,
      counterpart: quote.client?.name ?? "—",
      status: quote.status,
      total: decimalToNumber(quote.totalAmount),
      date: quote.quoteDate.toISOString(),
      href: `/admin/sales/quotes`,
    })),
    ...latestPurchaseOrders.map((po) => ({
      id: po.id,
      type: "Purchase Order" as const,
      code: `PO-${po.poNumber.toString().padStart(4, "0")}`,
      counterpart: po.supplier?.name ?? "—",
      status: po.status,
      total: decimalToNumber(po.totalAmount),
      date: po.orderDate.toISOString(),
      href: `/admin`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const operationalTodo: DashboardSnapshot["operationalTodo"] = [
    {
      id: "quotes-expiring",
      label: "Quotes expiring in 7 days",
      count: quotesExpiringSoon,
      severity: quotesExpiringSoon > 5 ? "high" : quotesExpiringSoon > 0 ? "medium" : "low",
      description: "Send reminders or close out quotes before validity lapses.",
      href: "/admin/sales/quotes",
    },
    {
      id: "orders-confirmation",
      label: "Orders awaiting confirmation",
      count: ordersAwaitingConfirmation,
      severity: ordersAwaitingConfirmation > 3 ? "high" : ordersAwaitingConfirmation > 0 ? "medium" : "low",
      description: "Confirm approved orders to release fulfillment tasks.",
      href: "/admin/sales/orders",
    },
    {
      id: "receipts-overdue",
      label: "Receipts overdue",
      count: receiptsOverdue,
      severity: receiptsOverdue > 0 ? "high" : "low",
      description: "Follow up with suppliers on late inbound shipments.",
      href: "/admin",
    },
  ];

  return {
    timestamp: now.toISOString(),
    kpis: [
      {
        id: "sales-mtd",
        label: "Sales (MTD)",
        value: salesMtdValue,
        formatter: "currency",
        deltaPct: salesDelta.deltaPct,
        trend: salesDelta.trend,
        helper: "vs prev month",
      },
      {
        id: "avg-order",
        label: "Avg order value",
        value: avgOrderMtd,
        formatter: "currency",
        deltaPct: avgOrderDelta.deltaPct,
        trend: avgOrderDelta.trend,
        helper: "fulfilled orders",
      },
      {
        id: "quote-rate",
        label: "Quote win rate",
        value: Number(quoteRateCurrent.toFixed(1)),
        formatter: "percent",
        deltaPct: quoteRateDelta.deltaPct,
        trend: quoteRateDelta.trend,
        helper: "30-day window",
      },
      {
        id: "open-pos",
        label: "Open PO value",
        value: openPoValue,
        formatter: "currency",
        deltaPct: openPoDelta.deltaPct,
        trend: openPoDelta.trend,
        helper: `${openPoCurrent._count._all} active`,
      },
    ],
    monthlySales,
    lowStock,
    latestDocuments,
    operationalTodo,
  };
}

const getDashboardSnapshotCachedInternal = unstable_cache(
  async (companyId: string) => getDashboardSnapshot(companyId),
  ["dashboard-snapshot-v1"],
  { revalidate: 30 },
);

export function getDashboardSnapshotCached(companyId: string) {
  return getDashboardSnapshotCachedInternal(companyId);
}
