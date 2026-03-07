import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { runCompanyLlm } from "@/lib/llm";
import { requireAdminSession } from "@/lib/settings-api";

export async function POST() {
  try {
    const session = await requireAdminSession();

    const result = await runCompanyLlm({
      companyId: session.user.companyId,
      message: "Reply with exactly: OK",
      system: "You are a connection health-check agent. Return only plain text.",
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "LLM_CONFIG_TEST",
      entity: "company_llm_config",
      entityId: session.user.companyId,
      metadata: {
        provider: result.provider,
        model: result.model,
      },
    });

    return NextResponse.json({ data: { ok: true, provider: result.provider, model: result.model, output: result.content } });
  } catch (error) {
    return handleApiError(error);
  }
}
