import crypto from "node:crypto";
import { ApiError } from "@/lib/api-helpers";

type TelegramApiResponse = {
  ok: boolean;
  result?: unknown;
  description?: string;
};

type TelegramFile = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
};

function getSigningKey() {
  return (
    process.env.LLM_CONFIG_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "neuraos-telegram-fallback-key"
  );
}

export function getAppBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return nextAuth.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  throw new ApiError(500, "Cannot resolve app base URL for Telegram webhook");
}

export function deriveTelegramSecretToken(companyId: string, botToken: string) {
  const hmac = crypto.createHmac("sha256", getSigningKey());
  hmac.update(`${companyId}:${botToken}`);
  return hmac.digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyTelegramSecretToken(input: {
  companyId: string;
  botToken: string;
  headerToken: string | null;
}) {
  if (!input.headerToken) return false;
  const expected = deriveTelegramSecretToken(input.companyId, input.botToken);
  return safeEqual(expected, input.headerToken);
}

export async function setTelegramWebhook(input: { companyId: string; botToken: string }) {
  const baseUrl = getAppBaseUrl();
  const secretToken = deriveTelegramSecretToken(input.companyId, input.botToken);
  const webhookUrl = `${baseUrl}/api/integrations/telegram/webhook/${input.companyId}`;

  const response = await fetch(`https://api.telegram.org/bot${input.botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message"],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as TelegramApiResponse;
  if (!response.ok || !payload.ok) {
    throw new ApiError(400, payload.description ?? "Failed to configure Telegram webhook");
  }

  return { webhookUrl };
}

export async function sendTelegramMessage(input: { botToken: string; chatId: number | string; text: string }) {
  const response = await fetch(`https://api.telegram.org/bot${input.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: false,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as TelegramApiResponse;
  if (!response.ok || !payload.ok) {
    throw new ApiError(400, payload.description ?? "Failed to send Telegram message");
  }
}

export async function getTelegramFile(input: { botToken: string; fileId: string }) {
  const response = await fetch(
    `https://api.telegram.org/bot${input.botToken}/getFile?file_id=${encodeURIComponent(input.fileId)}`,
  );
  const payload = (await response.json().catch(() => ({}))) as TelegramApiResponse;
  if (!response.ok || !payload.ok || !payload.result) {
    throw new ApiError(400, payload.description ?? "Failed to fetch Telegram file metadata");
  }
  return payload.result as TelegramFile;
}

export async function downloadTelegramFile(input: { botToken: string; filePath: string }) {
  const response = await fetch(
    `https://api.telegram.org/file/bot${input.botToken}/${input.filePath.replace(/^\/+/, "")}`,
  );
  if (!response.ok) {
    throw new ApiError(400, "Failed to download Telegram file");
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
