import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

async function getClientOrThrow(companyId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId },
  });
  if (!client) {
    throw new ApiError(404, "Client not found");
  }
  return client;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_SALES"]);
    const { clientId } = await context.params;

    const client = await getClientOrThrow(session.user.companyId, clientId);
    return NextResponse.json({ data: client });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_SALES"]);
    const { clientId } = await context.params;

    const body = await req.json();
    const updates = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
    };

    if (updates.name !== undefined && !String(updates.name).trim()) {
      throw new ApiError(400, "name cannot be empty");
    }

    await getClientOrThrow(session.user.companyId, clientId);

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(updates.name !== undefined ? { name: String(updates.name).trim() } : {}),
        ...(updates.email !== undefined ? { email: updates.email ?? null } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone ?? null } : {}),
        ...(updates.address !== undefined ? { address: updates.address ?? null } : {}),
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "client",
      entityId: client.id,
      action: "CLIENT_UPDATE",
      metadata: { clientId: client.id },
    });

    return NextResponse.json({ data: client });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_SALES"]);
    const { clientId } = await context.params;

    const existing = await getClientOrThrow(session.user.companyId, clientId);
    const linkedQuotes = await prisma.salesQuote.count({ where: { clientId } });
    const linkedOrders = await prisma.salesOrder.count({ where: { clientId } });
    if (linkedQuotes > 0 || linkedOrders > 0) {
      throw new ApiError(
        409,
        "Client is linked to quotes/orders and cannot be deleted. Archive or rename instead.",
      );
    }

    await prisma.client.delete({ where: { id: clientId } });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "client",
      entityId: clientId,
      action: "CLIENT_DELETE",
      metadata: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
