import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ensureRoles, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { enforcePlanLimit } from "@/lib/subscription-limits";

export async function GET() {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);

    const warehouses = await prisma.warehouse.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: warehouses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);
    await enforcePlanLimit(session.user.companyId, "warehouses");

    const body = await req.json();
    const { name, location } = body;

    if (!name) {
      throw new ApiError(400, "Name is required");
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        companyId: session.user.companyId,
        name,
        location: location ?? null,
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "warehouse",
      entityId: warehouse.id,
      action: "WAREHOUSE_CREATE",
      metadata: { name: warehouse.name },
    });

    return NextResponse.json({ data: warehouse }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
