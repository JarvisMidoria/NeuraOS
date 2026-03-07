import type { NextRequest } from "next/server";
import { LlmProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { DEFAULT_LLM_MODEL, getCompanyLlmConfig } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskSecret } from "@/lib/secrets";
import { requireAdminSession } from "@/lib/settings-api";

function parseProvider(raw: unknown): LlmProvider {
  const value = String(raw ?? "OPENAI").trim().toUpperCase();
  if (value === "OPENAI") return "OPENAI";
  if (value === "OPENAI_COMPATIBLE") return "OPENAI_COMPATIBLE";
  throw new ApiError(400, "Unsupported provider");
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    const config = await getCompanyLlmConfig(session.user.companyId);

    return NextResponse.json({
      data: {
        configured: Boolean(config),
        provider: config?.provider ?? "OPENAI",
        baseUrl: config?.baseUrl ?? "",
        defaultModel: config?.defaultModel ?? DEFAULT_LLM_MODEL,
        isEnabled: config?.isEnabled ?? false,
        keyHint: config?.keyHint ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();

    const provider = parseProvider(body.provider);
    const defaultModel = String(body.defaultModel ?? DEFAULT_LLM_MODEL).trim();
    const baseUrl = body.baseUrl ? String(body.baseUrl).trim() : null;
    const isEnabled = Boolean(body.isEnabled);
    const apiKeyRaw = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!defaultModel) {
      throw new ApiError(400, "defaultModel is required");
    }

    const existing = await getCompanyLlmConfig(session.user.companyId);
    if (!existing && !apiKeyRaw) {
      throw new ApiError(400, "apiKey is required for initial setup");
    }

    if (isEnabled && !existing && !apiKeyRaw) {
      throw new ApiError(400, "apiKey is required before enabling");
    }

    const encryptedApiKey = apiKeyRaw ? encryptSecret(apiKeyRaw) : undefined;
    const keyHint = apiKeyRaw ? maskSecret(apiKeyRaw) : undefined;

    const saved = await prisma.companyLlmConfig.upsert({
      where: { companyId: session.user.companyId },
      create: {
        companyId: session.user.companyId,
        provider,
        baseUrl: provider === "OPENAI" ? null : baseUrl,
        defaultModel,
        isEnabled,
        encryptedApiKey: encryptedApiKey ?? "",
        keyHint: keyHint ?? "",
      },
      update: {
        provider,
        baseUrl: provider === "OPENAI" ? null : baseUrl,
        defaultModel,
        isEnabled,
        ...(encryptedApiKey ? { encryptedApiKey } : {}),
        ...(keyHint ? { keyHint } : {}),
      },
      select: {
        provider: true,
        baseUrl: true,
        defaultModel: true,
        isEnabled: true,
        keyHint: true,
      },
    });

    if (!saved.keyHint) {
      throw new ApiError(400, "apiKey must be provided at least once");
    }

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "LLM_CONFIG_UPSERT",
      entity: "company_llm_config",
      entityId: session.user.companyId,
      metadata: {
        provider: saved.provider,
        isEnabled: saved.isEnabled,
        hasNewKey: Boolean(apiKeyRaw),
      },
    });

    return NextResponse.json({
      data: {
        configured: true,
        provider: saved.provider,
        baseUrl: saved.baseUrl ?? "",
        defaultModel: saved.defaultModel,
        isEnabled: saved.isEnabled,
        keyHint: saved.keyHint,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requireAdminSession();

    await prisma.companyLlmConfig.deleteMany({ where: { companyId: session.user.companyId } });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "LLM_CONFIG_DELETE",
      entity: "company_llm_config",
      entityId: session.user.companyId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
