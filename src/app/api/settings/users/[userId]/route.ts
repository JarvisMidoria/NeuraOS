import { UserKind } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";

const userInclude = {
  roles: {
    include: {
      role: { select: { id: true, name: true } },
    },
  },
} as const;

interface RouteContext {
  params: Promise<{ userId: string }>;
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  kind: UserKind;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: Array<{ role: { id: string; name: string } }>;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    kind: user.kind,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles: user.roles.map((entry) => entry.role),
  };
}

async function getUser(companyId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    include: userInclude,
  });
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { userId } = await context.params;
    const body = await req.json();
    const current = await getUser(session.user.companyId, userId);
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { ownerUserId: true },
    });

    const roleIds: string[] | null = Array.isArray(body.roleIds)
      ? Array.from(new Set(body.roleIds.map((id: unknown) => String(id))))
      : null;

    if (roleIds) {
      const roles = await prisma.role.findMany({
        where: { companyId: session.user.companyId, id: { in: roleIds } },
        select: { id: true },
      });
      if (roles.length !== roleIds.length) throw new ApiError(400, "One or more roles are invalid");
    }

    if (company?.ownerUserId === userId && body.isActive === false) {
      throw new ApiError(400, "Tenant owner cannot be deactivated");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId } });
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          ...(body.email !== undefined ? { email: String(body.email).trim().toLowerCase() } : {}),
          ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
          ...(body.password
            ? {
                passwordHash: await bcrypt.hash(String(body.password), 10),
              }
            : {}),
          ...(roleIds
            ? {
                roles: {
                  create: roleIds.map((roleId) => ({
                    companyId: session.user.companyId,
                    roleId,
                  })),
                },
              }
            : {}),
        },
        include: userInclude,
      });
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "user",
      entityId: userId,
      action: "USER_UPDATE",
      metadata: {
        from: { name: current.name, email: current.email, isActive: current.isActive },
        to: { name: updated.name, email: updated.email, isActive: updated.isActive },
      },
    });

    return NextResponse.json({ data: serializeUser(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { userId } = await context.params;

    if (session.user.id === userId) {
      throw new ApiError(400, "You cannot delete your own account");
    }

    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { ownerUserId: true },
    });
    if (company?.ownerUserId === userId) {
      throw new ApiError(400, "Tenant owner cannot be deleted");
    }

    await getUser(session.user.companyId, userId);

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "user",
      entityId: userId,
      action: "USER_DELETE",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
