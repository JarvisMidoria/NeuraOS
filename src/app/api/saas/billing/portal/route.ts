import { NextResponse } from "next/server";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, getStripeClient } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["ADMIN"]);

    const stripe = getStripeClient();
    if (!stripe) throw new ApiError(500, "Stripe is not configured");

    const subscription = await prisma.tenantSubscription.findUnique({
      where: { companyId: session.user.companyId },
      select: { stripeCustomerId: true },
    });

    if (!subscription?.stripeCustomerId) {
      throw new ApiError(400, "No Stripe customer linked yet");
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getAppBaseUrl()}/admin/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    return handleApiError(error);
  }
}
