import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LlmAccessMode, LlmProvider } from "@prisma/client";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/saas-admin";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

function hasSharedProviderConfigured() {
  return Boolean(process.env.SHARED_LLM_API_KEY?.trim());
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSuperAdminSession();
    const { tenantId } = await context.params;
    const body = await req.json();

    const enabled = Boolean(body.enabled);

    const company = await prisma.company.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!company) throw new ApiError(404, "Tenant not found");

    const existing = await prisma.companyLlmConfig.findUnique({ where: { companyId: tenantId } });

    if (enabled) {
      if (!existing) {
        if (!hasSharedProviderConfigured()) {
          throw new ApiError(400, "Cannot enable AI: shared provider is not configured and tenant has no BYOK config");
        }
      } else if (existing.accessMode === LlmAccessMode.BYOK && !existing.encryptedApiKey) {
        throw new ApiError(400, "Cannot enable AI: tenant BYOK key is missing");
      } else if (existing.accessMode === LlmAccessMode.SHARED && !hasSharedProviderConfigured()) {
        throw new ApiError(400, "Cannot enable AI: shared provider is not configured");
      }
    }

    const updated = await prisma.companyLlmConfig.upsert({
      where: { companyId: tenantId },
      create: {
        companyId: tenantId,
        accessMode: LlmAccessMode.SHARED,
        provider: LlmProvider.OPENAI,
        defaultModel: process.env.SHARED_LLM_MODEL?.trim() || "gpt-4o-mini",
        isEnabled: enabled,
      },
      update: {
        isEnabled: enabled,
      },
      select: {
        companyId: true,
        isEnabled: true,
        accessMode: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: tenantId,
        userId: session.user.id,
        entity: "company_llm_config",
        entityId: updated.companyId,
        action: enabled ? "TENANT_AI_ENABLE" : "TENANT_AI_DISABLE",
        metadata: {
          bySuperAdminId: session.user.id,
          accessMode: updated.accessMode,
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
