import Stripe from "stripe";
import { NextResponse } from "next/server";
import { BillingEventStatus, BillingEventType, Prisma, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
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

function centsToAmount(value: number | null | undefined) {
  if (typeof value !== "number") return null;
  return Number((value / 100).toFixed(2));
}

function upperCurrency(value: string | null | undefined) {
  if (!value) return null;
  return value.toUpperCase();
}

async function findCompanyIdByStripeRefs({
  metadataCompanyId,
  stripeSubscriptionId,
  stripeCustomerId,
}: {
  metadataCompanyId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}) {
  if (metadataCompanyId) return metadataCompanyId;
  if (stripeSubscriptionId) {
    const bySubscription = await prisma.tenantSubscription.findFirst({
      where: { stripeSubscriptionId },
      select: { companyId: true },
    });
    if (bySubscription?.companyId) return bySubscription.companyId;
  }
  if (stripeCustomerId) {
    const byCustomer = await prisma.tenantSubscription.findFirst({
      where: { stripeCustomerId },
      select: { companyId: true },
    });
    if (byCustomer?.companyId) return byCustomer.companyId;
  }
  return null;
}

async function recordBillingEvent(args: {
  stripeEventId: string;
  companyId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeInvoiceId?: string | null;
  type: BillingEventType;
  status: BillingEventStatus;
  plan?: SubscriptionPlan | null;
  amount?: number | null;
  currencyCode?: string | null;
  occurredAt: Date;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.billingEvent.upsert({
    where: { stripeEventId: args.stripeEventId },
    create: {
      stripeEventId: args.stripeEventId,
      companyId: args.companyId,
      stripeCustomerId: args.stripeCustomerId ?? null,
      stripeSubscriptionId: args.stripeSubscriptionId ?? null,
      stripeInvoiceId: args.stripeInvoiceId ?? null,
      type: args.type,
      status: args.status,
      plan: args.plan ?? null,
      amount: args.amount ?? null,
      currencyCode: args.currencyCode ?? null,
      occurredAt: args.occurredAt,
      metadata: args.metadata,
    },
    update: {},
  });
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

        await recordBillingEvent({
          stripeEventId: event.id,
          companyId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          type: BillingEventType.CHECKOUT_COMPLETED,
          status: BillingEventStatus.SUCCEEDED,
          plan: plan ?? undefined,
          amount: centsToAmount(session.amount_total),
          currencyCode: upperCurrency(session.currency),
          occurredAt: new Date(event.created * 1000),
          metadata: {
            checkoutSessionId: session.id,
          },
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubscriptionId = subscription.id;
      const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : null;
      const status = normalizeStripeStatus(subscription.status);
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = resolvePlanFromPrice(priceId);
      const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
      const companyId = await findCompanyIdByStripeRefs({
        stripeSubscriptionId,
        stripeCustomerId,
      });

      await prisma.tenantSubscription.updateMany({
        where: { stripeSubscriptionId },
        data: {
          ...(plan ? { plan } : {}),
          status,
          renewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
          ...(status === SubscriptionStatus.CANCELED ? { canceledAt: new Date() } : { canceledAt: null }),
        },
      });

      if (companyId) {
        await recordBillingEvent({
          stripeEventId: event.id,
          companyId,
          stripeCustomerId,
          stripeSubscriptionId,
          type:
            event.type === "customer.subscription.deleted"
              ? BillingEventType.SUBSCRIPTION_CANCELED
              : BillingEventType.SUBSCRIPTION_UPDATED,
          status:
            event.type === "customer.subscription.deleted"
              ? BillingEventStatus.FAILED
              : BillingEventStatus.INFO,
          plan: plan ?? undefined,
          amount: null,
          currencyCode: null,
          occurredAt: new Date(event.created * 1000),
          metadata: {
            stripeStatus: subscription.status,
          },
        });
      }
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const stripeInvoiceId = invoice.id;
      const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const companyId = await findCompanyIdByStripeRefs({
        metadataCompanyId: invoice.metadata?.companyId ?? null,
        stripeSubscriptionId,
        stripeCustomerId,
      });

      if (stripeSubscriptionId) {
        await prisma.tenantSubscription.updateMany({
          where: { stripeSubscriptionId },
          data: {
            status:
              event.type === "invoice.payment_succeeded"
                ? SubscriptionStatus.ACTIVE
                : SubscriptionStatus.PAST_DUE,
            ...(event.type === "invoice.payment_succeeded" ? { canceledAt: null } : {}),
          },
        });
      }

      if (companyId) {
        await recordBillingEvent({
          stripeEventId: event.id,
          companyId,
          stripeCustomerId,
          stripeSubscriptionId,
          stripeInvoiceId,
          type:
            event.type === "invoice.payment_succeeded"
              ? BillingEventType.INVOICE_PAID
              : BillingEventType.INVOICE_PAYMENT_FAILED,
          status:
            event.type === "invoice.payment_succeeded"
              ? BillingEventStatus.SUCCEEDED
              : BillingEventStatus.FAILED,
          amount:
            event.type === "invoice.payment_succeeded"
              ? centsToAmount(invoice.amount_paid)
              : centsToAmount(invoice.amount_due),
          currencyCode: upperCurrency(invoice.currency),
          occurredAt: new Date(event.created * 1000),
          metadata: {
            invoiceNumber: invoice.number,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
