import { LlmProvider } from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";

export const DEFAULT_LLM_MODEL = "gpt-4o-mini";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

type OpenAiCompatibleMessage = {
  role: "system" | "user";
  content: string;
};

type OpenAiCompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function getCompanyLlmConfig(companyId: string) {
  return prisma.companyLlmConfig.findUnique({ where: { companyId } });
}

function resolveBaseUrl(provider: LlmProvider, baseUrl?: string | null) {
  if (provider === "OPENAI") return OPENAI_BASE_URL;
  if (baseUrl && baseUrl.trim()) return baseUrl.trim().replace(/\/$/, "");
  return OPENAI_BASE_URL;
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

  const apiKey = decryptSecret(config.encryptedApiKey);
  const model = input.modelOverride?.trim() || config.defaultModel || DEFAULT_LLM_MODEL;
  const baseUrl = resolveBaseUrl(config.provider, config.baseUrl);

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

  return { content, model, provider: config.provider };
}
