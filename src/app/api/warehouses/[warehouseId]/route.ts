import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ensureRoles, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ warehouseId: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);
    const { warehouseId } = await context.params;

    const body = await req.json();
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId: session.user.companyId },
    });

    if (!warehouse) {
      throw new ApiError(404, "Warehouse not found");
    }

    const updated = await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: {
        name: body.name ?? warehouse.name,
        location:
          body.location === undefined ? warehouse.location : body.location ? body.location : null,
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "warehouse",
      entityId: updated.id,
      action: "WAREHOUSE_UPDATE",
      metadata: {
        before: { name: warehouse.name, location: warehouse.location },
        after: { name: updated.name, location: updated.location },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);
    const { warehouseId } = await context.params;

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId: session.user.companyId },
    });

    if (!warehouse) {
      throw new ApiError(404, "Warehouse not found");
    }

    await prisma.warehouse.delete({ where: { id: warehouse.id } });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "warehouse",
      entityId: warehouse.id,
      action: "WAREHOUSE_DELETE",
      metadata: { before: { name: warehouse.name, location: warehouse.location }, after: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
