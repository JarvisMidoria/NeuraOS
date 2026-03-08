import { LlmProvider } from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";

export const DEFAULT_LLM_MODEL = "gpt-4o-mini";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_SHARED_DAILY_LIMIT = 80;

type OpenAiCompatibleMessage = {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

type OpenAiCompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export async function getCompanyLlmConfig(companyId: string) {
  return prisma.companyLlmConfig.findUnique({ where: { companyId } });
}

function resolveBaseUrl(provider: LlmProvider, baseUrl?: string | null) {
  if (provider === "OPENAI") return OPENAI_BASE_URL;
  if (baseUrl && baseUrl.trim()) return baseUrl.trim().replace(/\/$/, "");
  return OPENAI_BASE_URL;
}

function sharedProvider(): LlmProvider {
  return (process.env.SHARED_LLM_PROVIDER ?? "OPENAI").trim().toUpperCase() === "OPENAI_COMPATIBLE"
    ? "OPENAI_COMPATIBLE"
    : "OPENAI";
}

function sharedModel() {
  return process.env.SHARED_LLM_MODEL?.trim() || DEFAULT_LLM_MODEL;
}

function sharedBaseUrl() {
  return process.env.SHARED_LLM_BASE_URL?.trim() || null;
}

function sharedApiKey() {
  return process.env.SHARED_LLM_API_KEY?.trim() || null;
}

async function enforceSharedUsageQuota(companyId: string) {
  const limitRaw = Number(process.env.SHARED_LLM_DAILY_LIMIT ?? DEFAULT_SHARED_DAILY_LIMIT);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : DEFAULT_SHARED_DAILY_LIMIT;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await prisma.auditLog.count({
    where: {
      companyId,
      action: "LLM_ASSISTANT_QUERY",
      entity: "llm_assistant",
      createdAt: { gte: since },
    },
  });

  if (used >= limit) {
    throw new ApiError(429, `Shared AI daily quota reached (${limit}/24h). Connect your own API key to continue.`);
  }

  return { used, limit };
}

export async function runCompanyLlm(input: {
  companyId: string;
  message: string;
  system?: string;
  modelOverride?: string;
}) {
  const config = await getCompanyLlmConfig(input.companyId);
  if (!config || !config.isEnabled) {
    throw new ApiError(400, "LLM provider not configured for this company");
  }

  let provider: LlmProvider;
  let baseUrl: string;
  let model: string;
  let apiKey: string;
  let accessMode: "SHARED" | "BYOK";
  let sharedQuota: { used: number; limit: number } | null = null;

  if (config.accessMode === "SHARED") {
    const key = sharedApiKey();
    if (!key) {
      throw new ApiError(500, "Shared AI is not enabled by platform admin");
    }
    provider = sharedProvider();
    baseUrl = resolveBaseUrl(provider, sharedBaseUrl());
    model = input.modelOverride?.trim() || sharedModel();
    apiKey = key;
    accessMode = "SHARED";
    sharedQuota = await enforceSharedUsageQuota(input.companyId);
  } else {
    if (!config.encryptedApiKey) {
      throw new ApiError(400, "Bring-your-own-key mode is selected but no API key is configured");
    }
    provider = config.provider;
    baseUrl = resolveBaseUrl(config.provider, config.baseUrl);
    model = input.modelOverride?.trim() || config.defaultModel || DEFAULT_LLM_MODEL;
    apiKey = decryptSecret(config.encryptedApiKey);
    accessMode = "BYOK";
  }

  const messages: OpenAiCompatibleMessage[] = [];
  if (input.system?.trim()) {
    messages.push({ role: "system", content: input.system.trim() });
  }
  messages.push({ role: "user", content: input.message });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ApiError(400, payload.error?.message ?? "LLM provider request failed");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ApiError(502, "LLM provider returned an empty response");
  }

  return {
    content,
    model,
    provider,
    accessMode,
    sharedQuota,
    usage: {
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
      totalTokens: payload.usage?.total_tokens ?? 0,
    },
  };
}

export async function runCompanyLlmWithImage(input: {
  companyId: string;
  prompt: string;
  imageDataUrl: string;
  system?: string;
  modelOverride?: string;
}) {
  const config = await getCompanyLlmConfig(input.companyId);
  if (!config || !config.isEnabled) {
    throw new ApiError(400, "LLM provider not configured for this company");
  }

  let provider: LlmProvider;
  let baseUrl: string;
  let model: string;
  let apiKey: string;
  let accessMode: "SHARED" | "BYOK";
  let sharedQuota: { used: number; limit: number } | null = null;

  if (config.accessMode === "SHARED") {
    const key = sharedApiKey();
    if (!key) {
      throw new ApiError(500, "Shared AI is not enabled by platform admin");
    }
    provider = sharedProvider();
    baseUrl = resolveBaseUrl(provider, sharedBaseUrl());
    model = input.modelOverride?.trim() || sharedModel();
    apiKey = key;
    accessMode = "SHARED";
    sharedQuota = await enforceSharedUsageQuota(input.companyId);
  } else {
    if (!config.encryptedApiKey) {
      throw new ApiError(400, "Bring-your-own-key mode is selected but no API key is configured");
    }
    provider = config.provider;
    baseUrl = resolveBaseUrl(config.provider, config.baseUrl);
    model = input.modelOverride?.trim() || config.defaultModel || DEFAULT_LLM_MODEL;
    apiKey = decryptSecret(config.encryptedApiKey);
    accessMode = "BYOK";
  }

  const messages: OpenAiCompatibleMessage[] = [];
  if (input.system?.trim()) {
    messages.push({ role: "system", content: input.system.trim() });
  }
  messages.push({
    role: "user",
    content: [
      { type: "text", text: input.prompt },
      { type: "image_url", image_url: { url: input.imageDataUrl } },
    ],
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ApiError(400, payload.error?.message ?? "LLM provider request failed");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ApiError(502, "LLM provider returned an empty response");
  }

  return {
    content,
    model,
    provider,
    accessMode,
    sharedQuota,
    usage: {
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
      totalTokens: payload.usage?.total_tokens ?? 0,
    },
  };
}
