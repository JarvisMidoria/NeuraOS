import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensurePermissions,
  ensureRoles,
  handleApiError,
  requireSession,
} from "@/lib/api-helpers";
import { convertQuoteToOrder } from "@/lib/sales/conversion";

interface RouteContext {
  params: Promise<{ quoteId: string }>;
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);
    ensurePermissions(session, ["MANAGE_SALES"]);
    const { quoteId } = await context.params;

    const order = await convertQuoteToOrder(
      {
        quoteId,
        companyId: session.user.companyId,
        userId: session.user.id,
      },
      prisma,
    );

    return NextResponse.json({
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
