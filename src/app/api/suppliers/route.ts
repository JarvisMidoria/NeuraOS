import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const suppliers = await prisma.supplier.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: suppliers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const body = await req.json();
    const { name, email, phone, address } = body;

    if (!name) {
      throw new ApiError(400, "name is required");
    }

    const supplier = await prisma.supplier.create({
      data: {
        companyId: session.user.companyId,
        name,
        email: email ?? null,
        phone: phone ?? null,
        address: address ?? null,
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "supplier",
      entityId: supplier.id,
      action: "SUPPLIER_CREATE",
      metadata: { name: supplier.name },
    });

    return NextResponse.json({ data: supplier }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
