import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { getAnalyticsSnapshot } from "@/lib/analytics-service";
import { perfLog, perfNow } from "@/lib/perf";

export async function GET(req: NextRequest) {
  const startedAt = perfNow();
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);

    const monthsParam = Number(new URL(req.url).searchParams.get("months") ?? "6");
    const data = await getAnalyticsSnapshot(session.user.companyId, monthsParam);

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  } finally {
    perfLog("api.analytics.overview.GET", startedAt, 500);
  }
}
