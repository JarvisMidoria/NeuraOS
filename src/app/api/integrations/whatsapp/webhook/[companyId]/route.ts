import type { NextRequest } from "next/server";
import { IngestionSource, UserKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { applyIngestionJob, createIngestionJob } from "@/lib/ingestion";
import { runErpAssistant } from "@/lib/erp-assistant";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";
import {
  downloadWhatsAppMedia,
  fetchWhatsAppMediaMeta,
  sendWhatsAppText,
  verifyWhatsAppToken,
} from "@/lib/whatsapp";

type WhatsAppMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
};

function chunks(input: string, max = 3500) {
  const values: string[] = [];
  for (let i = 0; i < input.length; i += max) {
    values.push(input.slice(i, i + max));
  }
  return values.length ? values : [""];
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

function formatReply(result: Awaited<ReturnType<typeof runErpAssistant>>["structured"]) {
  const lines: string[] = [result.title, result.summary];
  const sections: Array<{ title: string; rows: typeof result.priorities }> = [
    { title: "Priorities", rows: result.priorities },
    { title: "Insights", rows: result.insights },
    { title: "Actions", rows: result.actions },
  ];

  for (const section of sections) {
    if (!section.rows.length) continue;
    lines.push("", `${section.title}:`);
    for (const row of section.rows.slice(0, 5)) {
      lines.push(`- ${row.label}: ${row.detail}`);
    }
  }

  return lines.join("\n").trim();
}

function firstMessage(payload: WhatsAppWebhookPayload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const message = change.value?.messages?.[0];
      if (message) return message;
    }
  }
  return null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await context.params;
    const mode = req.nextUrl.searchParams.get("hub.mode");
    const challenge = req.nextUrl.searchParams.get("hub.challenge");
    const verifyToken = req.nextUrl.searchParams.get("hub.verify_token");

    if (mode !== "subscribe" || !challenge) {
      return NextResponse.json({ ok: true });
    }

    const isValid = verifyWhatsAppToken({ companyId, verifyToken });
    if (!isValid) {
      return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
    }

    return new NextResponse(challenge, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await context.params;
    const config = await prisma.companyMessagingConfig.findUnique({
      where: { companyId },
      select: {
        whatsappEnabled: true,
        whatsappPhoneNumber: true,
        whatsappAccessTokenEncrypted: true,
      },
    });

    if (!config?.whatsappEnabled || !config.whatsappAccessTokenEncrypted) {
      return NextResponse.json({ ok: true });
    }

    const accessToken = decryptSecret(config.whatsappAccessTokenEncrypted);
    const payload = (await req.json().catch(() => ({}))) as WhatsAppWebhookPayload;
    const message = firstMessage(payload);

    if (!message?.from) {
      return NextResponse.json({ ok: true });
    }

    const actorUserId = await resolveIntegrationActorUserId(companyId);

    const media = message.document?.id
      ? {
          mediaId: message.document.id,
          fileName: message.document.filename || `whatsapp-document-${Date.now()}`,
          mimeType: message.document.mime_type || "application/octet-stream",
          caption: message.document.caption,
        }
      : message.image?.id
      ? {
          mediaId: message.image.id,
          fileName: `whatsapp-image-${Date.now()}.jpg`,
          mimeType: message.image.mime_type || "image/jpeg",
          caption: message.image.caption,
        }
      : null;

    if (media?.mediaId) {
      const mediaMeta = await fetchWhatsAppMediaMeta({
        accessToken,
        mediaId: media.mediaId,
      });
      const fileBuffer = await downloadWhatsAppMedia({
        accessToken,
        url: mediaMeta.url ?? "",
      });

      const job = await createIngestionJob({
        companyId,
        createdByUserId: actorUserId ?? undefined,
        source: IngestionSource.WHATSAPP,
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSizeBytes: mediaMeta.file_size,
        fileBuffer,
        explicitText: media.caption?.trim() || undefined,
      });

      let resolved = job;
      if (actorUserId && job.status === "READY_APPLY") {
        resolved = await applyIngestionJob({
          companyId,
          jobId: job.id,
          actorUserId,
        });
      }

      if (config.whatsappPhoneNumber) {
        const applied = resolved.actions.filter((action) => action.status === "APPLIED").length;
        const failed = resolved.actions.filter((action) => action.status === "FAILED").length;
        const skipped = resolved.actions.filter((action) => action.status === "SKIPPED").length;
        const text = [
          `NeuraOS import processed: ${resolved.fileName ?? "file"}`,
          `Job: ${resolved.id}`,
          `Status: ${resolved.status}`,
          `Actions: ${resolved.actions.length} (applied ${applied}, failed ${failed}, skipped ${skipped})`,
        ].join("\n");

        for (const part of chunks(text)) {
          await sendWhatsAppText({
            accessToken,
            phoneNumberId: config.whatsappPhoneNumber,
            to: message.from,
            text: part,
          });
        }
      }

      return NextResponse.json({ ok: true });
    }

    const rawText = message.text?.body?.trim() || "";
    if (!rawText) {
      return NextResponse.json({ ok: true });
    }

    const response = await runErpAssistant({
      scopedCompanyId: companyId,
      configCompanyId: companyId,
      message: rawText,
      channel: "whatsapp",
    });

    if (config.whatsappPhoneNumber) {
      for (const part of chunks(formatReply(response.structured))) {
        await sendWhatsAppText({
          accessToken,
          phoneNumberId: config.whatsappPhoneNumber,
          to: message.from,
          text: part,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
