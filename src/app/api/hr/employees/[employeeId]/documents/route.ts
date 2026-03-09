import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HrDocumentType } from "@prisma/client";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";
import { assertCanManageHr, assertEmployeeInScope, resolveHrAccess } from "@/lib/hr-access";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ employeeId: string }>;
}

function normalizeType(value: unknown): HrDocumentType {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (
    normalized === "CONTRACT" ||
    normalized === "IDENTITY" ||
    normalized === "PAYSLIP" ||
    normalized === "CERTIFICATE" ||
    normalized === "INTERNAL" ||
    normalized === "OTHER"
  ) {
    return normalized;
  }
  return "OTHER";
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);
    assertCanManageHr(access);

    const { employeeId } = await context.params;
    await assertEmployeeInScope({ ...access, scope: "ALL" }, employeeId);

    const body = await req.json();
    const fileName = String(body.fileName ?? "").trim();
    if (!fileName) {
      throw new ApiError(400, "fileName is required");
    }

    const document = await prisma.employeeDocument.create({
      data: {
        companyId: access.companyId,
        employeeId,
        type: normalizeType(body.type),
        fileName,
        fileUrl: body.fileUrl ? String(body.fileUrl).trim() : null,
        mimeType: body.mimeType ? String(body.mimeType).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        issuedAt: normalizeDate(body.issuedAt),
        expiresAt: normalizeDate(body.expiresAt),
        uploadedByUserId: session.user.id,
      },
      include: {
        uploadedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
