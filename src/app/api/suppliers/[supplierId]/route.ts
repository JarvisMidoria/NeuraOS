import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ supplierId: string }>;
}

async function getSupplierOrThrow(companyId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, companyId },
  });
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  return supplier;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);
    const { supplierId } = await context.params;

    const supplier = await getSupplierOrThrow(session.user.companyId, supplierId);
    return NextResponse.json({ data: supplier });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);
    const { supplierId } = await context.params;

    const body = await req.json();
    const updates = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
    };

    if (updates.name && !updates.name.trim()) {
      throw new ApiError(400, "name cannot be empty");
    }

    await getSupplierOrThrow(session.user.companyId, supplierId);

    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.email !== undefined ? { email: updates.email ?? null } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone ?? null } : {}),
        ...(updates.address !== undefined ? { address: updates.address ?? null } : {}),
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "supplier",
      entityId: supplier.id,
      action: "SUPPLIER_UPDATE",
      metadata: { supplierId: supplier.id },
    });

    return NextResponse.json({ data: supplier });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);
    const { supplierId } = await context.params;

    await getSupplierOrThrow(session.user.companyId, supplierId);

    await prisma.supplier.delete({ where: { id: supplierId } });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "supplier",
      entityId: supplierId,
      action: "SUPPLIER_DELETE",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
