import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export type PlanFeature = "products" | "warehouses" | "users" | "customFields";

const PLAN_LIMITS: Record<SubscriptionPlan, Record<PlanFeature, number>> = {
  FREE: { products: 50, warehouses: 2, users: 3, customFields: 5 },
  STARTER: { products: 500, warehouses: 10, users: 15, customFields: 40 },
  GROWTH: { products: 5000, warehouses: 60, users: 120, customFields: 300 },
  ENTERPRISE: { products: 50000, warehouses: 500, users: 5000, customFields: 5000 },
};

const BLOCKED_STATUSES: SubscriptionStatus[] = [SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELED];

async function getSubscription(companyId: string) {
  return prisma.tenantSubscription.findUnique({
    where: { companyId },
    select: {
      plan: true,
      status: true,
      seatLimit: true,
      billingEmail: true,
      renewsAt: true,
      companyId: true,
    },
  });
}

export async function ensureSubscriptionActiveOrTrialing(companyId: string) {
  const subscription = await getSubscription(companyId);
  if (!subscription) return { plan: SubscriptionPlan.FREE, status: SubscriptionStatus.TRIALING };

  if (BLOCKED_STATUSES.includes(subscription.status)) {
    throw new ApiError(402, `Subscription is ${subscription.status}. Update billing to continue.`);
  }

  return subscription;
}

export async function getCompanyPlanLimits(companyId: string) {
  const subscription = await getSubscription(companyId);
  const plan = subscription?.plan ?? SubscriptionPlan.FREE;
  const status = subscription?.status ?? SubscriptionStatus.TRIALING;
  const limits = PLAN_LIMITS[plan];
  return { plan, status, limits, subscription };
}

export async function enforcePlanLimit(companyId: string, feature: PlanFeature) {
  const { plan, status, limits } = await getCompanyPlanLimits(companyId);

  if (BLOCKED_STATUSES.includes(status)) {
    throw new ApiError(402, `Subscription is ${status}. Update billing to continue.`);
  }

  const max = limits[feature];

  let current = 0;
  if (feature === "products") {
    current = await prisma.product.count({ where: { companyId } });
  } else if (feature === "warehouses") {
    current = await prisma.warehouse.count({ where: { companyId } });
  } else if (feature === "users") {
    current = await prisma.user.count({ where: { companyId, isActive: true } });
  } else if (feature === "customFields") {
    current = await prisma.customFieldDefinition.count({ where: { companyId } });
  }

  if (current >= max) {
    throw new ApiError(402, `Plan ${plan} limit reached for ${feature} (${max}). Upgrade your plan.`);
  }
}
