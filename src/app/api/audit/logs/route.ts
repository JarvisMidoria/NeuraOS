import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

function toDateOrNull(input: string | null) {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInt(input: string | null, fallback: number, min: number, max: number) {
  const raw = Number(input ?? String(fallback));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(raw)));
}

function toCsvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  const lines = [headers.map(toCsvCell).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((key) => toCsvCell(row[key])).join(","));
  });
  return `${lines.join("\n")}\n`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["ADMIN"]);

    const url = new URL(req.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const page = toInt(url.searchParams.get("page"), 1, 1, 10000);
    const pageSize = toInt(url.searchParams.get("pageSize"), 20, 1, 200);
    const entity = (url.searchParams.get("entity") ?? "").trim();
    const action = (url.searchParams.get("action") ?? "").trim();
    const userId = (url.searchParams.get("userId") ?? "").trim();
    const from = toDateOrNull(url.searchParams.get("from"));
    const to = toDateOrNull(url.searchParams.get("to"));
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();

    const where: Prisma.AuditLogWhereInput = {
      companyId: session.user.companyId,
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...((from || to)
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { action: { contains: query, mode: "insensitive" } },
              { entity: { contains: query, mode: "insensitive" } },
              { entityId: { contains: query, mode: "insensitive" } },
              { user: { is: { name: { contains: query, mode: "insensitive" } } } },
              { user: { is: { email: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    if (format === "csv") {
      const csvRows = rows.map((row) => ({
        createdAt: row.createdAt.toISOString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        actorName: row.user?.name ?? "System",
        actorEmail: row.user?.email ?? "",
        metadata: row.metadata ? JSON.stringify(row.metadata) : "",
      }));
      const csv = toCsv(csvRows, ["createdAt", "action", "entity", "entityId", "actorName", "actorEmail", "metadata"]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      });
    }

    const entities = await prisma.auditLog.findMany({
      where: { companyId: session.user.companyId },
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
      take: 200,
    });

    const actions = await prisma.auditLog.findMany({
      where: { companyId: session.user.companyId },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 300,
    });

    return NextResponse.json({
      page,
      pageSize,
      total,
      data: rows,
      filters: {
        entities: entities.map((item) => item.entity),
        actions: actions.map((item) => item.action),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
