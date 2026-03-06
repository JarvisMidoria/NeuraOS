import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ fieldId: string }>;
}

async function getField(companyId: string, fieldId: string) {
  const field = await prisma.customFieldDefinition.findFirst({
    where: { id: fieldId, companyId },
  });
  if (!field) throw new ApiError(404, "Custom field not found");
  return field;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { fieldId } = await context.params;
    const current = await getField(session.user.companyId, fieldId);
    const body = await req.json();

    const updated = await prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: {
        ...(body.label !== undefined ? { label: String(body.label).trim() } : {}),
        ...(body.fieldType !== undefined ? { fieldType: String(body.fieldType).trim().toLowerCase() } : {}),
        ...(body.isRequired !== undefined ? { isRequired: Boolean(body.isRequired) } : {}),
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "customFieldDefinition",
      entityId: fieldId,
      action: "CUSTOM_FIELD_UPDATE",
      metadata: { from: current, to: updated },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { fieldId } = await context.params;
    const current = await getField(session.user.companyId, fieldId);

    const valueCount = await prisma.customFieldValue.count({ where: { fieldId } });
    if (valueCount > 0) {
      throw new ApiError(400, "Cannot delete a field with values");
    }

    await prisma.customFieldDefinition.delete({ where: { id: fieldId } });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "customFieldDefinition",
      entityId: fieldId,
      action: "CUSTOM_FIELD_DELETE",
      metadata: { fieldKey: current.fieldKey },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
