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

export async function GET() {
  try {
    const session = await requireAdminSession();

    const roles = await prisma.role.findMany({
      where: { companyId: session.user.companyId },
      include: roleInclude,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: roles.map(serializeRole) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();

    const name = String(body.name ?? "").trim();
    if (!name) throw new ApiError(400, "name is required");

    const permissionIds: string[] = Array.isArray(body.permissionIds)
      ? Array.from(new Set(body.permissionIds.map((id: unknown) => String(id))))
      : [];

    const permissions = permissionIds.length
      ? await prisma.permission.findMany({
          where: { companyId: session.user.companyId, id: { in: permissionIds } },
          select: { id: true },
        })
      : [];

    if (permissions.length !== permissionIds.length) {
      throw new ApiError(400, "One or more permissions are invalid");
    }

    const role = await prisma.role.create({
      data: {
        companyId: session.user.companyId,
        name,
        description: body.description ? String(body.description).trim() : null,
        permissions: {
          create: permissionIds.map((permissionId) => ({
            companyId: session.user.companyId,
            permissionId,
          })),
        },
      },
      include: roleInclude,
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "role",
      entityId: role.id,
      action: "ROLE_CREATE",
      metadata: { name: role.name },
    });

    return NextResponse.json({ data: serializeRole(role) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
