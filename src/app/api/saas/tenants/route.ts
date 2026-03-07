import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, SubscriptionPlan, SubscriptionStatus, UserKind } from "@prisma/client";
import { handleApiError, ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/saas-admin";
import { DEFAULT_PERMISSION_CODES } from "@/lib/default-rbac";

function parseIntInRange(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parsePlan(value: unknown): SubscriptionPlan {
  if (value === "STARTER" || value === "GROWTH" || value === "ENTERPRISE") return value;
  return "FREE";
}

function parseStatus(value: unknown): SubscriptionStatus {
  if (value === "ACTIVE" || value === "PAST_DUE" || value === "CANCELED") return value;
  return "TRIALING";
}

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdminSession();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = parseIntInRange(url.searchParams.get("page"), 1, 1, 10000);
    const pageSize = parseIntInRange(url.searchParams.get("pageSize"), 20, 1, 100);

    const where: Prisma.CompanyWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { domain: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        include: {
          subscription: true,
          llmConfig: {
            select: {
              isEnabled: true,
              accessMode: true,
            },
          },
          users: {
            where: { kind: UserKind.TENANT_ADMIN },
            select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true },
          },
          _count: {
            select: {
              users: true,
              products: true,
              salesOrders: true,
              purchaseOrders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      page,
      pageSize,
      total,
      data: companies.map((company) => ({
        id: company.id,
        name: company.name,
        domain: company.domain,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        subscription: company.subscription,
        llm: company.llmConfig,
        counts: company._count,
        adminUsers: company.users.slice(0, 3),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSuperAdminSession();
    const body = await req.json();

    const companyName = String(body.companyName ?? "").trim();
    const domain = body.domain ? String(body.domain).trim() : null;
    const adminName = String(body.adminName ?? "").trim();
    const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
    const adminPassword = String(body.adminPassword ?? "");

    if (!companyName) throw new ApiError(400, "companyName is required");
    if (!adminName) throw new ApiError(400, "adminName is required");
    if (!adminEmail) throw new ApiError(400, "adminEmail is required");
    if (adminPassword.length < 8) throw new ApiError(400, "adminPassword must be at least 8 chars");

    const plan = parsePlan(body.plan);
    const status = parseStatus(body.status);
    const seatLimit = parseIntInRange(body.seatLimit, 3, 1, 100000);
    const billingEmail = body.billingEmail ? String(body.billingEmail).trim().toLowerCase() : null;
    const renewsAt = body.renewsAt ? new Date(String(body.renewsAt)) : null;

    const existing = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
    if (existing) throw new ApiError(409, "adminEmail already exists");

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          domain,
        },
      });

      const permissions = await Promise.all(
        DEFAULT_PERMISSION_CODES.map((perm) =>
          tx.permission.create({
            data: {
              companyId: company.id,
              code: perm.code,
              description: perm.description,
            },
          }),
        ),
      );

      const role = await tx.role.create({
        data: {
          companyId: company.id,
          name: "Admin",
          description: "Tenant administrator",
        },
      });

      await Promise.all(
        permissions.map((permission) =>
          tx.rolePermission.create({
            data: {
              companyId: company.id,
              roleId: role.id,
              permissionId: permission.id,
            },
          }),
        ),
      );

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          kind: UserKind.TENANT_ADMIN,
          name: adminName,
          email: adminEmail,
          passwordHash,
          isActive: true,
        },
      });

      await tx.company.update({
        where: { id: company.id },
        data: { ownerUserId: user.id },
      });

      await tx.userRole.create({
        data: {
          companyId: company.id,
          userId: user.id,
          roleId: role.id,
        },
      });

      const subscription = await tx.tenantSubscription.create({
        data: {
          companyId: company.id,
          plan,
          status,
          seatLimit,
          billingEmail,
          renewsAt,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          userId: user.id,
          entity: "tenant",
          entityId: company.id,
          action: "TENANT_BOOTSTRAP",
          metadata: {
            bySuperAdminId: session.user.id,
            subscriptionPlan: plan,
            subscriptionStatus: status,
          },
        },
      });

      return { company, user, subscription };
    });

    return NextResponse.json(
      {
        data: {
          company: created.company,
          adminUser: {
            id: created.user.id,
            email: created.user.email,
            name: created.user.name,
          },
          subscription: created.subscription,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
