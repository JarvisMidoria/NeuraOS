import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";
import { runErpAssistant } from "@/lib/erp-assistant";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const scopedCompanyId = session.user.companyId;
    const configCompanyId = session.user.liveCompanyId ?? session.user.companyId;
    const body = await req.json();

    // Never allow caller-provided tenant overrides.
    if (body.companyId !== undefined || body.tenantId !== undefined || body.userId !== undefined) {
      throw new ApiError(400, "Tenant override fields are not allowed");
    }

    const message = String(body.message ?? "").trim();
    const model = body.model ? String(body.model).trim() : undefined;

    if (!message) {
      throw new ApiError(400, "message is required");
    }
    if (message.length > 4000) {
      throw new ApiError(400, "message is too long (max 4000 chars)");
    }

    const result = await runErpAssistant({
      scopedCompanyId,
      configCompanyId,
      message,
      model,
      actorUserId: session.user.id,
      channel: "web",
    });

    return NextResponse.json({
      data: {
        output: result.output,
        provider: result.provider,
        model: result.model,
        accessMode: result.accessMode,
        sharedQuota: result.sharedQuota,
        usage: result.usage,
        structured: result.structured,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
