import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_SALES"]);

    const clients = await prisma.client.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
        _count: {
          select: {
            salesQuotes: true,
            salesOrders: true,
          },
        },
      },
    });

    return NextResponse.json({ data: clients });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_SALES"]);

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      throw new ApiError(400, "name is required");
    }

    const client = await prisma.client.create({
      data: {
        companyId: session.user.companyId,
        name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "client",
      entityId: client.id,
      action: "CLIENT_CREATE",
      metadata: { name: client.name },
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
