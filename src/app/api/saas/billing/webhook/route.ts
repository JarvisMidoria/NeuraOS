import Stripe from "stripe";
import { NextResponse } from "next/server";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

function resolvePlanFromPrice(priceId: string | null | undefined): SubscriptionPlan | null {
  if (!priceId) return null;
  if (process.env.STRIPE_PRICE_STARTER === priceId) return SubscriptionPlan.STARTER;
  if (process.env.STRIPE_PRICE_GROWTH === priceId) return SubscriptionPlan.GROWTH;
  if (process.env.STRIPE_PRICE_ENTERPRISE === priceId) return SubscriptionPlan.ENTERPRISE;
  return null;
}

function normalizeStripeStatus(status: string): SubscriptionStatus {
  if (status === "active") return SubscriptionStatus.ACTIVE;
  if (status === "past_due" || status === "unpaid" || status === "incomplete_expired") return SubscriptionStatus.PAST_DUE;
  if (status === "canceled") return SubscriptionStatus.CANCELED;
  return SubscriptionStatus.TRIALING;
}

export async function POST(req: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      if (companyId && customerId) {
        let plan: SubscriptionPlan | null = null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id;
          plan = resolvePlanFromPrice(priceId);
        }

        await prisma.tenantSubscription.upsert({
          where: { companyId },
          create: {
            companyId,
            plan: plan ?? SubscriptionPlan.FREE,
            status: SubscriptionStatus.ACTIVE,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            renewsAt: null,
          },
          update: {
            plan: plan ?? undefined,
            status: SubscriptionStatus.ACTIVE,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            canceledAt: null,
          },
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubscriptionId = subscription.id;
      const status = normalizeStripeStatus(subscription.status);
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = resolvePlanFromPrice(priceId);
      const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

      await prisma.tenantSubscription.updateMany({
        where: { stripeSubscriptionId },
        data: {
          ...(plan ? { plan } : {}),
          status,
          renewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
          ...(status === SubscriptionStatus.CANCELED ? { canceledAt: new Date() } : { canceledAt: null }),
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
