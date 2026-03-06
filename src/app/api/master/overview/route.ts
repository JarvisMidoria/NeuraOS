import { NextResponse } from "next/server";
import type { Prisma, SubscriptionPlan } from "@prisma/client";
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

function sumEstimatedRevenueByPlan(items: Array<{ plan: SubscriptionPlan; status: string }>) {
  return items
    .filter((item) => item.status === "ACTIVE" || item.status === "TRIALING")
    .reduce((sum, item) => sum + planMonthlyAmount(item.plan), 0);
}

function extractPlanFromAudit(metadata: Prisma.JsonValue | null): SubscriptionPlan | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const obj = metadata as Record<string, unknown>;

  const direct = obj.subscriptionPlan;
  if (direct === "FREE" || direct === "STARTER" || direct === "GROWTH" || direct === "ENTERPRISE") return direct;

  const data = obj.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const nested = (data as Record<string, unknown>).plan;
  if (nested === "FREE" || nested === "STARTER" || nested === "GROWTH" || nested === "ENTERPRISE") return nested;
  return null;
}

export async function GET(req: Request) {
  try {
    await requireSuperAdminSession();

    const url = new URL(req.url);
    const planFilter = parsePlanFilter(url.searchParams.get("plan"));
    const revenueRange = parseRevenueRange(url.searchParams.get("range"));
    const rangeStart = getRangeStart(revenueRange);

    const subscriptionWhere = planFilter === "ALL" ? {} : { plan: planFilter };

    const [subscriptions, alerts, latestSubscriptions, auditEvents, chartEvents] = await Promise.all([
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
      prisma.auditLog.findMany({
        where: {
          action: { in: ["TENANT_BOOTSTRAP", "TENANT_SUBSCRIPTION_UPDATE"] },
          createdAt: { gte: rangeStart },
        },
        select: { id: true, createdAt: true, action: true, metadata: true, company: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findMany({
        where: {
          action: { in: ["TENANT_BOOTSTRAP", "TENANT_SUBSCRIPTION_UPDATE"] },
          createdAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1)) },
        },
        select: { createdAt: true, metadata: true },
      }),
    ]);

    const byPlan = {
      FREE: subscriptions.filter((s) => s.plan === "FREE").length,
      STARTER: subscriptions.filter((s) => s.plan === "STARTER").length,
      GROWTH: subscriptions.filter((s) => s.plan === "GROWTH").length,
      ENTERPRISE: subscriptions.filter((s) => s.plan === "ENTERPRISE").length,
    };

    const activeRevenue = sumEstimatedRevenueByPlan(subscriptions);

    const revenueInRange = auditEvents.reduce((sum, event) => {
      const plan = extractPlanFromAudit(event.metadata);
      if (!plan) return sum;
      return sum + planMonthlyAmount(plan);
    }, 0);

    const now = new Date();
    const chartMap = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString();
      chartMap.set(key, 0);
    }

    chartEvents.forEach((event) => {
      const plan = extractPlanFromAudit(event.metadata);
      if (!plan) return;
      const month = new Date(Date.UTC(event.createdAt.getUTCFullYear(), event.createdAt.getUTCMonth(), 1)).toISOString();
      chartMap.set(month, (chartMap.get(month) ?? 0) + planMonthlyAmount(plan));
    });

    const chart = Array.from(chartMap.entries()).map(([iso, amount]) => ({
      iso,
      month: new Date(iso).toLocaleString("en", { month: "short" }),
      amount,
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
            amount: revenueInRange,
            activeMrr: activeRevenue,
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
          latestCustomers: latestSubscriptions.map((sub) => ({
            id: sub.companyId,
            companyName: sub.company.name,
            plan: sub.plan,
            amount: planMonthlyAmount(sub.plan),
            createdAt: sub.createdAt,
          })),
        },
      },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=45" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
