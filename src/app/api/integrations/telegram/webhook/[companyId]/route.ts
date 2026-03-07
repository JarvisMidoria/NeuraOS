import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { runErpAssistant } from "@/lib/erp-assistant";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";
import { getAppBaseUrl, sendTelegramMessage, verifyTelegramSecretToken } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    text?: string;
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
    const rawText = update.message?.text ?? "";
    if (!chatId || !rawText) {
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
          "NeuraOS Copilot connected.\nSend a business question (sales, stock, orders, purchasing) and I will answer using your tenant data only.",
      });
      return NextResponse.json({ ok: true });
    }

    const result = await runErpAssistant({
      scopedCompanyId: companyId,
      configCompanyId: companyId,
      message: prompt,
      channel: "telegram",
    });

    const reply = formatTelegramReply(result.structured, getAppBaseUrl());
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

