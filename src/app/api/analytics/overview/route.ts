import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { getAnalyticsSnapshot } from "@/lib/analytics-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);

    const monthsParam = Number(new URL(req.url).searchParams.get("months") ?? "6");
    const data = await getAnalyticsSnapshot(session.user.companyId, monthsParam);

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
