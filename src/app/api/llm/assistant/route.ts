import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { runCompanyLlm } from "@/lib/llm";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
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

    const result = await runCompanyLlm({
      companyId: session.user.companyId,
      message,
      modelOverride: model,
      system:
        "You are an ERP copilot for operations (sales, purchasing, inventory, planning). Keep answers concise and actionable. Never reference data from other tenants or organizations.",
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "LLM_ASSISTANT_QUERY",
      entity: "llm_assistant",
      entityId: session.user.companyId,
      metadata: {
        model: result.model,
        provider: result.provider,
        accessMode: result.accessMode,
        sharedQuota: result.sharedQuota ?? undefined,
        promptSize: message.length,
      },
    });

    return NextResponse.json({
      data: {
        output: result.content,
        provider: result.provider,
        model: result.model,
        accessMode: result.accessMode,
        sharedQuota: result.sharedQuota,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
