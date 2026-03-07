import type { NextRequest } from "next/server";
import { LlmAccessMode, LlmProvider } from "@prisma/client";
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

function parseAccessMode(raw: unknown): LlmAccessMode {
  const value = String(raw ?? "SHARED").trim().toUpperCase();
  if (value === "SHARED") return "SHARED";
  if (value === "BYOK") return "BYOK";
  throw new ApiError(400, "Unsupported access mode");
}

function hasSharedProviderConfigured() {
  return Boolean(process.env.SHARED_LLM_API_KEY?.trim());
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    const config = await getCompanyLlmConfig(session.user.companyId);

    return NextResponse.json({
      data: {
        configured: Boolean(config),
        accessMode: config?.accessMode ?? "SHARED",
        provider: config?.provider ?? "OPENAI",
        baseUrl: config?.baseUrl ?? "",
        defaultModel: config?.defaultModel ?? DEFAULT_LLM_MODEL,
        isEnabled: config?.isEnabled ?? false,
        keyHint: config?.keyHint ?? null,
        sharedAvailable: hasSharedProviderConfigured(),
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

    const accessMode = parseAccessMode(body.accessMode);
    const provider = parseProvider(body.provider);
    const defaultModel = String(body.defaultModel ?? DEFAULT_LLM_MODEL).trim();
    const baseUrl = body.baseUrl ? String(body.baseUrl).trim() : null;
    const isEnabled = Boolean(body.isEnabled);
    const apiKeyRaw = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!defaultModel) {
      throw new ApiError(400, "defaultModel is required");
    }

    if (accessMode === "SHARED" && isEnabled && !hasSharedProviderConfigured()) {
      throw new ApiError(400, "Shared AI is not available yet. Ask platform admin to configure SHARED_LLM_API_KEY.");
    }

    const existing = await getCompanyLlmConfig(session.user.companyId);

    if (accessMode === "BYOK") {
      if (!existing?.keyHint && !apiKeyRaw) {
        throw new ApiError(400, "apiKey is required for BYOK mode setup");
      }
      if (isEnabled && !existing?.keyHint && !apiKeyRaw) {
        throw new ApiError(400, "apiKey is required before enabling BYOK mode");
      }
    }

    const encryptedApiKey = apiKeyRaw ? encryptSecret(apiKeyRaw) : undefined;
    const keyHint = apiKeyRaw ? maskSecret(apiKeyRaw) : undefined;

    const saved = await prisma.companyLlmConfig.upsert({
      where: { companyId: session.user.companyId },
      create: {
        companyId: session.user.companyId,
        accessMode,
        provider,
        baseUrl: provider === "OPENAI" ? null : baseUrl,
        defaultModel,
        isEnabled,
        encryptedApiKey: encryptedApiKey,
        keyHint,
      },
      update: {
        accessMode,
        provider,
        baseUrl: provider === "OPENAI" ? null : baseUrl,
        defaultModel,
        isEnabled,
        ...(encryptedApiKey ? { encryptedApiKey } : {}),
        ...(keyHint ? { keyHint } : {}),
      },
      select: {
        accessMode: true,
        provider: true,
        baseUrl: true,
        defaultModel: true,
        isEnabled: true,
        keyHint: true,
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "LLM_CONFIG_UPSERT",
      entity: "company_llm_config",
      entityId: session.user.companyId,
      metadata: {
        accessMode: saved.accessMode,
        provider: saved.provider,
        isEnabled: saved.isEnabled,
        hasNewKey: Boolean(apiKeyRaw),
      },
    });

    return NextResponse.json({
      data: {
        configured: true,
        accessMode: saved.accessMode,
        provider: saved.provider,
        baseUrl: saved.baseUrl ?? "",
        defaultModel: saved.defaultModel,
        isEnabled: saved.isEnabled,
        keyHint: saved.keyHint,
        sharedAvailable: hasSharedProviderConfigured(),
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
