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

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: Array<{ role: { id: string; name: string } }>;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles: user.roles.map((entry) => entry.role),
  };
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    const users = await prisma.user.findMany({
      where: { companyId: session.user.companyId },
      include: userInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: users.map(serializeUser) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    const roleIds: string[] = Array.isArray(body.roleIds)
      ? Array.from(new Set(body.roleIds.map((id: unknown) => String(id))))
      : [];

    if (!email) throw new ApiError(400, "email is required");
    if (!name) throw new ApiError(400, "name is required");
    if (password.length < 8) throw new ApiError(400, "password must be at least 8 characters");

    const roles = await prisma.role.findMany({
      where: { companyId: session.user.companyId, id: { in: roleIds } },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) throw new ApiError(400, "One or more roles are invalid");

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        companyId: session.user.companyId,
        email,
        name,
        passwordHash,
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        roles: {
          create: roleIds.map((roleId) => ({
            companyId: session.user.companyId,
            roleId,
          })),
        },
      },
      include: userInclude,
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "user",
      entityId: user.id,
      action: "USER_CREATE",
      metadata: { email: user.email },
    });

    return NextResponse.json({ data: serializeUser(user) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
