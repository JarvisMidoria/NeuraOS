import type { NextRequest } from "next/server";
import { IngestionDocType, IngestionSource, IngestionStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { applyIngestionJob, createIngestionJob, serializeIngestionJob } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/settings-api";

function toInt(input: string | null, fallback: number, min: number, max: number) {
  const value = Number(input ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function toBool(input: unknown) {
  if (typeof input === "boolean") return input;
  const normalized = String(input ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseSource(input: unknown): IngestionSource {
  const value = String(input ?? "WEB_UPLOAD")
    .trim()
    .toUpperCase();
  if (Object.values(IngestionSource).includes(value as IngestionSource)) {
    return value as IngestionSource;
  }
  return IngestionSource.WEB_UPLOAD;
}

function parseStatus(input: string | null): IngestionStatus | null {
  if (!input) return null;
  const value = input.trim().toUpperCase();
  if (Object.values(IngestionStatus).includes(value as IngestionStatus)) {
    return value as IngestionStatus;
  }
  return null;
}

function parseDocType(input: string | null): IngestionDocType | null {
  if (!input) return null;
  const value = input.trim().toUpperCase();
  if (Object.values(IngestionDocType).includes(value as IngestionDocType)) {
    return value as IngestionDocType;
  }
  return null;
}

function parseSourceFilter(input: string | null): IngestionSource | null {
  if (!input) return null;
  const value = input.trim().toUpperCase();
  if (Object.values(IngestionSource).includes(value as IngestionSource)) {
    return value as IngestionSource;
  }
  return null;
}

function listWhere(companyId: string, req: NextRequest): Prisma.IngestionJobWhereInput {
  const url = new URL(req.url);
  const status = parseStatus(url.searchParams.get("status"));
  const docType = parseDocType(url.searchParams.get("docType"));
  const source = parseSourceFilter(url.searchParams.get("source"));
  const query = (url.searchParams.get("q") ?? "").trim();

  return {
    companyId,
    ...(status ? { status } : {}),
    ...(docType ? { docType } : {}),
    ...(source ? { source } : {}),
    ...(query
      ? {
          OR: [
            { fileName: { contains: query, mode: "insensitive" } },
            { rawText: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const url = new URL(req.url);
    const page = toInt(url.searchParams.get("page"), 1, 1, 10000);
    const pageSize = toInt(url.searchParams.get("pageSize"), 20, 1, 100);

    const where = listWhere(session.user.companyId, req);

    const [total, rows] = await Promise.all([
      prisma.ingestionJob.count({ where }),
      prisma.ingestionJob.findMany({
        where,
        include: {
          actions: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      page,
      pageSize,
      total,
      data: rows.map((row) => serializeIngestionJob(row)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    let source: IngestionSource = IngestionSource.WEB_UPLOAD;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let fileSizeBytes: number | undefined;
    let fileBuffer: Buffer | undefined;
    let explicitText: string | undefined;
    let autoApply = false;

    const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      source = parseSource(form.get("source"));
      explicitText = String(form.get("text") ?? "").trim() || undefined;
      autoApply = toBool(form.get("autoApply"));

      const uploaded = form.get("file");
      if (uploaded instanceof File) {
        fileName = uploaded.name || undefined;
        mimeType = uploaded.type || undefined;
        fileSizeBytes = uploaded.size;
        const arrayBuffer = await uploaded.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      const body = (await req.json()) as {
        source?: unknown;
        text?: unknown;
        autoApply?: unknown;
      };
      source = parseSource(body.source);
      explicitText = String(body.text ?? "").trim() || undefined;
      autoApply = toBool(body.autoApply);
    }

    if (!fileBuffer && !explicitText) {
      return NextResponse.json({ error: "Provide a file or text" }, { status: 400 });
    }

    const created = await createIngestionJob({
      companyId: session.user.companyId,
      createdByUserId: session.user.id,
      source,
      fileName,
      mimeType,
      fileSizeBytes,
      fileBuffer,
      explicitText,
    });

    let resolved = created;
    if (autoApply && created.status === IngestionStatus.READY_APPLY) {
      resolved = await applyIngestionJob({
        companyId: session.user.companyId,
        jobId: created.id,
        actorUserId: session.user.id,
      });
    }

    return NextResponse.json({ data: serializeIngestionJob(resolved) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
