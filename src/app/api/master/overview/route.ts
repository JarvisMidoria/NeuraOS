import { NextResponse } from "next/server";
import type { SubscriptionPlan } from "@prisma/client";
import { BillingEventStatus, BillingEventType } from "@prisma/client";
import { handleApiError } from "@/lib/api-helpers";
import { planMonthlyAmount } from "@/lib/billing-plans";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/saas-admin";

type RevenueRange = "day" | "month" | "3m" | "6m" | "year";

function getRangeStart(range: RevenueRange) {
  const now = new Date();
  const start = new Date(now);
  if (range === "day") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  if (range === "3m") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  }
  if (range === "6m") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function parseRevenueRange(raw: string | null): RevenueRange {
  if (raw === "day" || raw === "month" || raw === "3m" || raw === "6m" || raw === "year") return raw;
  return "month";
}

function parsePlanFilter(raw: string | null): "ALL" | SubscriptionPlan {
  if (raw === "FREE" || raw === "STARTER" || raw === "GROWTH" || raw === "ENTERPRISE") return raw;
  return "ALL";
}

export async function GET(req: Request) {
  try {
    await requireSuperAdminSession();

    const url = new URL(req.url);
    const planFilter = parsePlanFilter(url.searchParams.get("plan"));
    const revenueRange = parseRevenueRange(url.searchParams.get("range"));
    const rangeStart = getRangeStart(revenueRange);

    const subscriptionWhere = planFilter === "ALL" ? {} : { plan: planFilter };

    const [subscriptions, alerts, latestSubscriptions, paidEventsInRange, paidEventsForChart, latestPaidRows] =
      await Promise.all([
        prisma.tenantSubscription.findMany({
          where: subscriptionWhere,
          select: { plan: true, status: true },
        }),
        prisma.tenantSubscription.findMany({
          where: { status: "PAST_DUE" },
          include: { company: { select: { id: true, name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
        prisma.tenantSubscription.findMany({
          where: subscriptionWhere,
          include: { company: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.billingEvent.findMany({
          where: {
            type: BillingEventType.INVOICE_PAID,
            status: BillingEventStatus.SUCCEEDED,
            occurredAt: { gte: rangeStart },
            ...(planFilter === "ALL" ? {} : { plan: planFilter }),
          },
          select: { amount: true },
        }),
        prisma.billingEvent.findMany({
          where: {
            type: BillingEventType.INVOICE_PAID,
            status: BillingEventStatus.SUCCEEDED,
            occurredAt: {
              gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1)),
            },
            ...(planFilter === "ALL" ? {} : { plan: planFilter }),
          },
          select: { occurredAt: true, amount: true },
        }),
        prisma.billingEvent.findMany({
          where: {
            type: BillingEventType.INVOICE_PAID,
            status: BillingEventStatus.SUCCEEDED,
            ...(planFilter === "ALL" ? {} : { plan: planFilter }),
          },
          include: {
            company: { select: { id: true, name: true } },
          },
          orderBy: { occurredAt: "desc" },
          take: 50,
        }),
      ]);

    const byPlan = {
      FREE: subscriptions.filter((s) => s.plan === "FREE").length,
      STARTER: subscriptions.filter((s) => s.plan === "STARTER").length,
      GROWTH: subscriptions.filter((s) => s.plan === "GROWTH").length,
      ENTERPRISE: subscriptions.filter((s) => s.plan === "ENTERPRISE").length,
    };

    const activeMrr = subscriptions
      .filter((s) => s.status === "ACTIVE" || s.status === "TRIALING")
      .reduce((sum, s) => sum + planMonthlyAmount(s.plan), 0);

    const revenueInRange = paidEventsInRange.reduce((sum, event) => sum + Number(event.amount ?? 0), 0);

    const now = new Date();
    const chartMap = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString();
      chartMap.set(key, 0);
    }

    paidEventsForChart.forEach((event) => {
      const month = new Date(Date.UTC(event.occurredAt.getUTCFullYear(), event.occurredAt.getUTCMonth(), 1)).toISOString();
      chartMap.set(month, (chartMap.get(month) ?? 0) + Number(event.amount ?? 0));
    });

    const chart = Array.from(chartMap.entries()).map(([iso, amount]) => ({
      iso,
      month: new Date(iso).toLocaleString("en", { month: "short" }),
      amount: Number(amount.toFixed(2)),
    }));

    const latestMap = new Map<string, { id: string; companyName: string; plan: string; amount: number; createdAt: Date }>();
    for (const row of latestPaidRows) {
      if (latestMap.has(row.companyId)) continue;
      latestMap.set(row.companyId, {
        id: row.companyId,
        companyName: row.company.name,
        plan: row.plan ?? "FREE",
        amount: Number(row.amount ?? 0),
        createdAt: row.occurredAt,
      });
      if (latestMap.size >= 10) break;
    }

    const latestCustomers =
      latestMap.size > 0
        ? Array.from(latestMap.values()).map((item) => ({
            ...item,
            createdAt: item.createdAt,
          }))
        : latestSubscriptions.map((sub) => ({
            id: sub.companyId,
            companyName: sub.company.name,
            plan: sub.plan,
            amount: planMonthlyAmount(sub.plan),
            createdAt: sub.createdAt,
          }));

    return NextResponse.json(
      {
        data: {
          subscriptions: {
            total: subscriptions.length,
            byPlan,
          },
          revenue: {
            range: revenueRange,
            amount: Number(revenueInRange.toFixed(2)),
            activeMrr,
          },
          alerts: alerts.map((sub) => ({
            id: sub.companyId,
            companyId: sub.companyId,
            companyName: sub.company.name,
            status: sub.status,
            plan: sub.plan,
            billingEmail: sub.billingEmail,
            updatedAt: sub.updatedAt,
          })),
          chart,
          latestCustomers,
        },
      },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=45" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
