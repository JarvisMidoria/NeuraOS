import { NextResponse } from "next/server";
import { UserKind } from "@prisma/client";
import { requireSession } from "@/lib/api-helpers";
import { ensureSimulationCompany, getSimulationCompanyId } from "@/lib/simulation-service";
import { normalizeWorkspaceMode, WORKSPACE_COOKIE, type WorkspaceMode } from "@/lib/workspace-mode";

type Body = {
  mode?: WorkspaceMode;
};

export async function GET() {
  const session = await requireSession();
  const canUseSimulation = session.user.userKind === UserKind.TENANT_ADMIN;
  const liveCompanyId = session.user.liveCompanyId ?? session.user.companyId;
  const mode = (session.user.workspaceMode ?? "LIVE") as WorkspaceMode;

  return NextResponse.json({
    data: {
      mode,
      canUseSimulation,
      liveCompanyId,
      simulationCompanyId: canUseSimulation ? await getSimulationCompanyId(liveCompanyId) : null,
    },
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const canUseSimulation = session.user.userKind === UserKind.TENANT_ADMIN;
  if (!canUseSimulation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const mode = normalizeWorkspaceMode(body.mode);
  const liveCompanyId = session.user.liveCompanyId ?? session.user.companyId;

  if (mode === "SIMULATION") {
    await ensureSimulationCompany(liveCompanyId);
  }

  const response = NextResponse.json({
    data: {
      mode,
    },
  });
  response.cookies.set(WORKSPACE_COOKIE, mode, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 5,
    path: "/",
  });
  return response;
}
