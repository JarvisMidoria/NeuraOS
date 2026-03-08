import crypto from "node:crypto";
import { ApiError } from "@/lib/api-helpers";
import { getAppBaseUrl } from "@/lib/telegram";

type WhatsAppGraphMedia = {
  url?: string;
  mime_type?: string;
  file_size?: number;
  id?: string;
};

function getSigningKey() {
  return (
    process.env.LLM_CONFIG_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "neuraos-whatsapp-fallback-key"
  );
}

export function deriveWhatsAppVerifyToken(companyId: string) {
  const hmac = crypto.createHmac("sha256", getSigningKey());
  hmac.update(`wa:${companyId}`);
  return hmac.digest("hex").slice(0, 32);
}

export function verifyWhatsAppToken(input: {
  companyId: string;
  verifyToken: string | null;
}) {
  if (!input.verifyToken) return false;
  return input.verifyToken === deriveWhatsAppVerifyToken(input.companyId);
}

export function getWhatsAppWebhookUrl(companyId: string) {
  return `${getAppBaseUrl()}/api/integrations/whatsapp/webhook/${companyId}`;
}

export async function fetchWhatsAppMediaMeta(input: { accessToken: string; mediaId: string }) {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${encodeURIComponent(input.mediaId)}`,
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
    },
  );

  const payload = (await response.json().catch(() => ({}))) as WhatsAppGraphMedia & {
    error?: { message?: string };
  };
  if (!response.ok || !payload.url) {
    throw new ApiError(400, payload.error?.message ?? "Failed to fetch WhatsApp media metadata");
  }

  return payload;
}

export async function downloadWhatsAppMedia(input: { accessToken: string; url: string }) {
  const response = await fetch(input.url, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
  });
  if (!response.ok) {
    throw new ApiError(400, "Failed to download WhatsApp media");
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sendWhatsAppText(input: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}) {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${encodeURIComponent(input.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: { body: input.text.slice(0, 4096) },
      }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new ApiError(400, payload.error?.message ?? "Failed to send WhatsApp message");
  }
}
