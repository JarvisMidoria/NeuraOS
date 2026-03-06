import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";

const roleInclude = {
  permissions: {
    include: { permission: { select: { id: true, code: true, description: true } } },
  },
  users: { select: { id: true } },
} as const;

interface RouteContext {
  params: Promise<{ roleId: string }>;
}

function serializeRole(role: {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ permission: { id: string; code: string; description: string | null } }>;
  users: Array<{ id: string }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    userCount: role.users.length,
    permissions: role.permissions.map((entry) => entry.permission),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

async function getRole(companyId: string, roleId: string) {
  const role = await prisma.role.findFirst({ where: { id: roleId, companyId }, include: roleInclude });
  if (!role) throw new ApiError(404, "Role not found");
  return role;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { roleId } = await context.params;
    const body = await req.json();

    const current = await getRole(session.user.companyId, roleId);

    const permissionIds: string[] | null = Array.isArray(body.permissionIds)
      ? Array.from(new Set(body.permissionIds.map((id: unknown) => String(id))))
      : null;

    if (permissionIds) {
      const permissions = await prisma.permission.findMany({
        where: { companyId: session.user.companyId, id: { in: permissionIds } },
        select: { id: true },
      });
      if (permissions.length !== permissionIds.length) {
        throw new ApiError(400, "One or more permissions are invalid");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
      }

      return tx.role.update({
        where: { id: roleId },
        data: {
          ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
          ...(body.description !== undefined ? { description: body.description ? String(body.description).trim() : null } : {}),
          ...(permissionIds
            ? {
                permissions: {
                  create: permissionIds.map((permissionId) => ({
                    companyId: session.user.companyId,
                    permissionId,
                  })),
                },
              }
            : {}),
        },
        include: roleInclude,
      });
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "role",
      entityId: roleId,
      action: "ROLE_UPDATE",
      metadata: {
        from: { name: current.name, description: current.description },
        to: { name: updated.name, description: updated.description },
      },
    });

    return NextResponse.json({ data: serializeRole(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { roleId } = await context.params;
    const role = await getRole(session.user.companyId, roleId);

    if (role.users.length > 0) {
      throw new ApiError(400, "Cannot delete role assigned to users");
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.role.delete({ where: { id: roleId } }),
    ]);

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "role",
      entityId: roleId,
      action: "ROLE_DELETE",
      metadata: { name: role.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
