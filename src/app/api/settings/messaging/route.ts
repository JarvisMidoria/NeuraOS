import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/secrets";
import { requireAdminSession } from "@/lib/settings-api";
import { setTelegramWebhook } from "@/lib/telegram";

export async function GET() {
  try {
    const session = await requireAdminSession();
    const config = await prisma.companyMessagingConfig.findUnique({
      where: { companyId: session.user.companyId },
      select: {
        whatsappEnabled: true,
        whatsappPhoneNumber: true,
        whatsappBusinessAccountId: true,
        whatsappAccessTokenHint: true,
        telegramEnabled: true,
        telegramBotUsername: true,
        telegramBotTokenHint: true,
      },
    });

    return NextResponse.json({
      data: {
        whatsappEnabled: config?.whatsappEnabled ?? false,
        whatsappPhoneNumber: config?.whatsappPhoneNumber ?? "",
        whatsappBusinessAccountId: config?.whatsappBusinessAccountId ?? "",
        whatsappAccessTokenHint: config?.whatsappAccessTokenHint ?? null,
        telegramEnabled: config?.telegramEnabled ?? false,
        telegramBotUsername: config?.telegramBotUsername ?? "",
        telegramBotTokenHint: config?.telegramBotTokenHint ?? null,
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

    const whatsappEnabled = Boolean(body.whatsappEnabled);
    const whatsappPhoneNumber = typeof body.whatsappPhoneNumber === "string" ? body.whatsappPhoneNumber.trim() : "";
    const whatsappBusinessAccountId =
      typeof body.whatsappBusinessAccountId === "string" ? body.whatsappBusinessAccountId.trim() : "";
    const whatsappAccessTokenRaw =
      typeof body.whatsappAccessToken === "string" ? body.whatsappAccessToken.trim() : "";

    const telegramEnabled = Boolean(body.telegramEnabled);
    const telegramBotUsername = typeof body.telegramBotUsername === "string" ? body.telegramBotUsername.trim() : "";
    const telegramBotTokenRaw = typeof body.telegramBotToken === "string" ? body.telegramBotToken.trim() : "";

    const existing = await prisma.companyMessagingConfig.findUnique({
      where: { companyId: session.user.companyId },
      select: {
        telegramBotTokenEncrypted: true,
        whatsappAccessTokenHint: true,
        telegramBotTokenHint: true,
      },
    });

    const whatsappAccessTokenEncrypted = whatsappAccessTokenRaw ? encryptSecret(whatsappAccessTokenRaw) : undefined;
    const whatsappAccessTokenHint = whatsappAccessTokenRaw
      ? maskSecret(whatsappAccessTokenRaw)
      : existing?.whatsappAccessTokenHint ?? null;

    const telegramBotTokenEncrypted = telegramBotTokenRaw ? encryptSecret(telegramBotTokenRaw) : undefined;
    const telegramBotTokenHint = telegramBotTokenRaw
      ? maskSecret(telegramBotTokenRaw)
      : existing?.telegramBotTokenHint ?? null;

    const saved = await prisma.companyMessagingConfig.upsert({
      where: { companyId: session.user.companyId },
      create: {
        companyId: session.user.companyId,
        whatsappEnabled,
        whatsappPhoneNumber: whatsappPhoneNumber || null,
        whatsappBusinessAccountId: whatsappBusinessAccountId || null,
        whatsappAccessTokenEncrypted,
        whatsappAccessTokenHint,
        telegramEnabled,
        telegramBotUsername: telegramBotUsername || null,
        telegramBotTokenEncrypted,
        telegramBotTokenHint,
      },
      update: {
        whatsappEnabled,
        whatsappPhoneNumber: whatsappPhoneNumber || null,
        whatsappBusinessAccountId: whatsappBusinessAccountId || null,
        ...(whatsappAccessTokenEncrypted ? { whatsappAccessTokenEncrypted } : {}),
        whatsappAccessTokenHint,
        telegramEnabled,
        telegramBotUsername: telegramBotUsername || null,
        ...(telegramBotTokenEncrypted ? { telegramBotTokenEncrypted } : {}),
        telegramBotTokenHint,
      },
      select: {
        companyId: true,
        whatsappEnabled: true,
        whatsappPhoneNumber: true,
        whatsappBusinessAccountId: true,
        whatsappAccessTokenHint: true,
        telegramEnabled: true,
        telegramBotUsername: true,
        telegramBotTokenEncrypted: true,
        telegramBotTokenHint: true,
      },
    });

    if (saved.telegramEnabled) {
      const encryptedToken = saved.telegramBotTokenEncrypted ?? existing?.telegramBotTokenEncrypted;
      if (encryptedToken) {
        await setTelegramWebhook({
          companyId: saved.companyId,
          botToken: decryptSecret(encryptedToken),
        });
      }
    }

    return NextResponse.json({
      data: {
        whatsappEnabled: saved.whatsappEnabled,
        whatsappPhoneNumber: saved.whatsappPhoneNumber ?? "",
        whatsappBusinessAccountId: saved.whatsappBusinessAccountId ?? "",
        whatsappAccessTokenHint: saved.whatsappAccessTokenHint ?? null,
        telegramEnabled: saved.telegramEnabled,
        telegramBotUsername: saved.telegramBotUsername ?? "",
        telegramBotTokenHint: saved.telegramBotTokenHint ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
