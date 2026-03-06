import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, getStripeClient } from "@/lib/stripe";

const PRICE_ENV_BY_PLAN: Record<string, string> = {
  STARTER: "STRIPE_PRICE_STARTER",
  GROWTH: "STRIPE_PRICE_GROWTH",
  ENTERPRISE: "STRIPE_PRICE_ENTERPRISE",
};

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["ADMIN"]);
    const stripe = getStripeClient();
    if (!stripe) throw new ApiError(500, "Stripe is not configured");

    const body = await req.json();
    const plan = String(body.plan ?? "").toUpperCase();
    if (!PRICE_ENV_BY_PLAN[plan]) throw new ApiError(400, "Invalid plan");

    const priceId = process.env[PRICE_ENV_BY_PLAN[plan]];
    if (!priceId) {
      throw new ApiError(500, `Missing price env for ${plan}`);
    }

    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      include: { subscription: true },
    });
    if (!company) throw new ApiError(404, "Company not found");

    let customerId = company.subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: company.subscription?.billingEmail ?? session.user.email ?? undefined,
        name: company.name,
        metadata: {
          companyId: company.id,
        },
      });
      customerId = customer.id;

      await prisma.tenantSubscription.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          billingEmail: company.subscription?.billingEmail ?? session.user.email ?? null,
          stripeCustomerId: customerId,
        },
        update: {
          stripeCustomerId: customerId,
        },
      });
    }

    const base = getAppBaseUrl();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/admin/billing?checkout=success`,
      cancel_url: `${base}/admin/billing?checkout=canceled`,
      metadata: {
        companyId: company.id,
        requestedPlan: plan,
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    return handleApiError(error);
  }
}
