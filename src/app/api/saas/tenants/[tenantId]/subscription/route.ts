import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/saas-admin";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

function parsePlan(value: unknown): SubscriptionPlan | null {
  if (value === "FREE" || value === "STARTER" || value === "GROWTH" || value === "ENTERPRISE") return value;
  return null;
}

function parseStatus(value: unknown): SubscriptionStatus | null {
  if (value === "TRIALING" || value === "ACTIVE" || value === "PAST_DUE" || value === "CANCELED") return value;
  return null;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSuperAdminSession();
    const { tenantId } = await context.params;
    const body = await req.json();

    const existingCompany = await prisma.company.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!existingCompany) throw new ApiError(404, "Tenant not found");

    const plan = body.plan === undefined ? undefined : parsePlan(body.plan);
    const status = body.status === undefined ? undefined : parseStatus(body.status);
    if (body.plan !== undefined && !plan) throw new ApiError(400, "Invalid plan");
    if (body.status !== undefined && !status) throw new ApiError(400, "Invalid status");

    const data = {
      ...(plan ? { plan } : {}),
      ...(status ? { status } : {}),
      ...(body.seatLimit !== undefined ? { seatLimit: Math.max(1, Math.trunc(Number(body.seatLimit) || 1)) } : {}),
      ...(body.billingEmail !== undefined
        ? { billingEmail: body.billingEmail ? String(body.billingEmail).trim().toLowerCase() : null }
        : {}),
      ...(body.renewsAt !== undefined ? { renewsAt: body.renewsAt ? new Date(String(body.renewsAt)) : null } : {}),
      ...(status === "CANCELED" ? { canceledAt: new Date() } : {}),
      ...(status && status !== "CANCELED" ? { canceledAt: null } : {}),
    };

    const subscription = await prisma.tenantSubscription.upsert({
      where: { companyId: tenantId },
      create: {
        companyId: tenantId,
        plan: plan ?? "FREE",
        status: status ?? "TRIALING",
        seatLimit: (data.seatLimit as number | undefined) ?? 3,
        billingEmail: (data.billingEmail as string | null | undefined) ?? null,
        renewsAt: (data.renewsAt as Date | null | undefined) ?? null,
      },
      update: data,
    });

    const auditAction =
      body.deleteRequested === true
        ? "TENANT_DELETE_REQUEST"
        : status === "PAST_DUE"
          ? "TENANT_SUSPEND"
          : status === "CANCELED"
            ? "TENANT_CANCEL"
            : "TENANT_SUBSCRIPTION_UPDATE";

    await prisma.auditLog.create({
      data: {
        companyId: tenantId,
        userId: session.user.id,
        entity: "tenant_subscription",
        entityId: subscription.id,
        action: auditAction,
        metadata: {
          updatedBySuperAdminId: session.user.id,
          data,
        },
      },
    });

    return NextResponse.json({ data: subscription });
  } catch (error) {
    return handleApiError(error);
  }
}
