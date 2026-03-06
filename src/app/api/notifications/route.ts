import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { listCompanyNotifications, maybeSyncCompanyNotifications, syncCompanyNotifications } from "@/lib/notifications-service";

function parseLimit(req: NextRequest) {
  const value = Number(new URL(req.url).searchParams.get("limit") ?? "20");
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(100, Math.trunc(value)));
}

function shouldSync(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("sync");
  return raw === "1" || raw === "true";
}

function shouldAutoSync(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("auto");
  return raw === "1" || raw === "true";
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);

    if (shouldSync(req)) {
      await syncCompanyNotifications(session.user.companyId);
    } else if (shouldAutoSync(req)) {
      await maybeSyncCompanyNotifications(session.user.companyId);
    }

    const payload = await listCompanyNotifications(session.user.companyId, parseLimit(req));
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);

    const result = await syncCompanyNotifications(session.user.companyId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
