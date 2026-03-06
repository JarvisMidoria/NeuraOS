import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";
import { enforcePlanLimit } from "@/lib/subscription-limits";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const entityType = new URL(req.url).searchParams.get("entityType");

    const fields = await prisma.customFieldDefinition.findMany({
      where: {
        companyId: session.user.companyId,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: [{ entityType: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({ data: fields });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    await enforcePlanLimit(session.user.companyId, "customFields");
    const body = await req.json();

    const entityType = String(body.entityType ?? "").trim().toLowerCase();
    const fieldKey = String(body.fieldKey ?? "").trim().toLowerCase();
    const label = String(body.label ?? "").trim();
    const fieldType = String(body.fieldType ?? "text").trim().toLowerCase();

    if (!entityType) throw new ApiError(400, "entityType is required");
    if (!fieldKey) throw new ApiError(400, "fieldKey is required");
    if (!label) throw new ApiError(400, "label is required");

    const field = await prisma.customFieldDefinition.create({
      data: {
        companyId: session.user.companyId,
        entityType,
        fieldKey,
        label,
        fieldType,
        isRequired: Boolean(body.isRequired),
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "customFieldDefinition",
      entityId: field.id,
      action: "CUSTOM_FIELD_CREATE",
      metadata: { entityType: field.entityType, fieldKey: field.fieldKey },
    });

    return NextResponse.json({ data: field }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
