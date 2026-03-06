import type { SubscriptionPlan } from "@prisma/client";

export const PLAN_MONTHLY_AMOUNT: Record<SubscriptionPlan, number> = {
  FREE: 0,
  STARTER: 49,
  GROWTH: 129,
  ENTERPRISE: 399,
};

export function planMonthlyAmount(plan: SubscriptionPlan) {
  return PLAN_MONTHLY_AMOUNT[plan] ?? 0;
}
