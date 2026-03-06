import { NextResponse } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { markAllNotificationsRead } from "@/lib/notifications-service";

export async function PATCH() {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);

    const result = await markAllNotificationsRead(session.user.companyId);
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
