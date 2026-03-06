import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { markNotificationRead } from "@/lib/notifications-service";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);
    const { notificationId } = await context.params;

    const result = await markNotificationRead(session.user.companyId, notificationId);
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
