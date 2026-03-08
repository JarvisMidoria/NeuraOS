import type { NextRequest } from "next/server";
import { UserKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { applyIngestionJob, createIngestionJob } from "@/lib/ingestion";
import { runErpAssistant } from "@/lib/erp-assistant";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";
import {
  downloadTelegramFile,
  getAppBaseUrl,
  getTelegramFile,
  sendTelegramMessage,
  verifyTelegramSecretToken,
} from "@/lib/telegram";

type TelegramPhoto = {
  file_id?: string;
  file_unique_id?: string;
  file_size?: number;
  width?: number;
  height?: number;
};

type TelegramDocument = {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    text?: string;
    caption?: string;
    document?: TelegramDocument;
    photo?: TelegramPhoto[];
  };
};

function normalizeTelegramPrompt(input: string) {
  const text = input.trim();
  if (!text) return "";
  if (text.startsWith("/start")) {
    return "__START__";
  }
  return text.replace(/^\/\w+\s*/, "").trim();
}

function formatTelegramReply(
  structured: Awaited<ReturnType<typeof runErpAssistant>>["structured"],
  baseUrl: string,
) {
  const lines: string[] = [];
  lines.push(structured.title);
  lines.push(structured.summary);

  const sections: Array<{ title: string; rows: typeof structured.priorities }> = [
    { title: "Priorities", rows: structured.priorities },
    { title: "Insights", rows: structured.insights },
    { title: "Actions", rows: structured.actions },
  ];

  for (const section of sections) {
    if (!section.rows.length) continue;
    lines.push("");
    lines.push(`${section.title}:`);
    for (const row of section.rows.slice(0, 5)) {
      const link = row.href ? ` ${baseUrl}${row.href}` : "";
      lines.push(`- ${row.label}: ${row.detail}${link}`);
    }
  }

  const output = lines.join("\n").trim();
  if (output.length <= 3500) return output;
  return `${output.slice(0, 3490)}\n...`;
}

async function resolveIntegrationActorUserId(companyId: string) {
  const users = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true, kind: true },
    take: 20,
  });

  const byPriority = (kind: UserKind) => users.find((user) => user.kind === kind)?.id;
  return (
    byPriority(UserKind.TENANT_ADMIN) ||
    byPriority(UserKind.MASTER) ||
    byPriority(UserKind.TENANT_MEMBER) ||
    null
  );
}

function pickTelegramUpload(update: TelegramUpdate) {
  const message = update.message;
  if (!message) return null;

  if (message.document?.file_id) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name || `telegram-document-${Date.now()}`,
      mimeType: message.document.mime_type || "application/octet-stream",
      fileSizeBytes: message.document.file_size,
      caption: String(message.caption ?? "").trim() || undefined,
    };
  }

  if (Array.isArray(message.photo) && message.photo.length) {
    const largest = [...message.photo].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
    if (!largest?.file_id) return null;
    return {
      fileId: largest.file_id,
      fileName: `telegram-photo-${largest.file_unique_id ?? Date.now()}.jpg`,
      mimeType: "image/jpeg",
      fileSizeBytes: largest.file_size,
      caption: String(message.caption ?? "").trim() || undefined,
    };
  }

  return null;
}

export async function POST(req: NextRequest, context: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await context.params;
    if (!companyId) {
      return NextResponse.json({ ok: true });
    }

    const config = await prisma.companyMessagingConfig.findUnique({
      where: { companyId },
      select: {
        telegramEnabled: true,
        telegramBotTokenEncrypted: true,
      },
    });

    if (!config?.telegramEnabled || !config.telegramBotTokenEncrypted) {
      return NextResponse.json({ ok: true });
    }

    const botToken = decryptSecret(config.telegramBotTokenEncrypted);
    const headerToken = req.headers.get("x-telegram-bot-api-secret-token");
    const isValid = verifyTelegramSecretToken({
      companyId,
      botToken,
      headerToken,
    });
    if (!isValid) {
      return NextResponse.json({ error: "Invalid telegram secret" }, { status: 401 });
    }

    const update = (await req.json().catch(() => ({}))) as TelegramUpdate;
    const chatId = update.message?.chat?.id;
    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    const baseUrl = getAppBaseUrl();

    const upload = pickTelegramUpload(update);
    if (upload?.fileId) {
      const actorUserId = await resolveIntegrationActorUserId(companyId);
      const telegramFile = await getTelegramFile({ botToken, fileId: upload.fileId });

      if (!telegramFile.file_path) {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: "I couldn't access this file path on Telegram. Please try again.",
        });
        return NextResponse.json({ ok: true });
      }

      const fileBuffer = await downloadTelegramFile({ botToken, filePath: telegramFile.file_path });
      const job = await createIngestionJob({
        companyId,
        createdByUserId: actorUserId ?? undefined,
        source: "TELEGRAM",
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        fileSizeBytes: upload.fileSizeBytes,
        fileBuffer,
        explicitText: upload.caption,
      });

      let resolved = job;
      if (actorUserId && job.status === "READY_APPLY") {
        resolved = await applyIngestionJob({
          companyId,
          jobId: job.id,
          actorUserId,
        });
      }

      const applied = resolved.actions.filter((action) => action.status === "APPLIED").length;
      const failed = resolved.actions.filter((action) => action.status === "FAILED").length;
      const skipped = resolved.actions.filter((action) => action.status === "SKIPPED").length;

      await sendTelegramMessage({
        botToken,
        chatId,
        text: [
          `Ingestion processed: ${resolved.fileName ?? "document"}`,
          `- Job: ${resolved.id}`,
          `- Status: ${resolved.status}`,
          `- Actions: ${resolved.actions.length} (applied ${applied}, failed ${failed}, skipped ${skipped})`,
          `- Review: ${baseUrl}/admin/settings`,
        ].join("\n"),
      });

      return NextResponse.json({ ok: true });
    }

    const rawText = update.message?.text ?? "";
    if (!rawText) {
      return NextResponse.json({ ok: true });
    }

    const prompt = normalizeTelegramPrompt(rawText);
    if (!prompt) {
      return NextResponse.json({ ok: true });
    }

    if (prompt === "__START__") {
      await sendTelegramMessage({
        botToken,
        chatId,
        text:
          "NeuraOS Copilot connected.\nSend a business question (sales, stock, orders, purchasing), or send a document/photo to auto-ingest into your tenant.",
      });
      return NextResponse.json({ ok: true });
    }

    const result = await runErpAssistant({
      scopedCompanyId: companyId,
      configCompanyId: companyId,
      message: prompt,
      channel: "telegram",
    });

    const reply = formatTelegramReply(result.structured, baseUrl);
    await sendTelegramMessage({
      botToken,
      chatId,
      text: reply,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
