import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { decimalToString, requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ taxId: string }>;
}

function serializeTaxRule(rule: {
  id: string;
  code: string;
  label: string;
  rate: Prisma.Decimal;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: Date;
}) {
  return {
    id: rule.id,
    code: rule.code,
    label: rule.label,
    rate: decimalToString(rule.rate),
    isDefault: rule.isDefault,
    isActive: rule.isActive,
    updatedAt: rule.updatedAt,
  };
}

async function getRule(companyId: string, taxId: string) {
  const rule = await prisma.taxRule.findFirst({ where: { id: taxId, companyId } });
  if (!rule) throw new ApiError(404, "Tax rule not found");
  return rule;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { taxId } = await context.params;
    const body = await req.json();
    const current = await getRule(session.user.companyId, taxId);

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.taxRule.updateMany({
          where: { companyId: session.user.companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.taxRule.update({
        where: { id: taxId },
        data: {
          ...(body.code !== undefined ? { code: String(body.code).trim().toUpperCase() } : {}),
          ...(body.label !== undefined ? { label: String(body.label).trim() } : {}),
          ...(body.rate !== undefined ? { rate: new Prisma.Decimal(body.rate) } : {}),
          ...(body.isDefault !== undefined ? { isDefault: Boolean(body.isDefault) } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        },
      });
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "taxRule",
      entityId: updated.id,
      action: "TAX_RULE_UPDATE",
      metadata: { from: serializeTaxRule(current), to: serializeTaxRule(updated) },
    });

    return NextResponse.json({ data: serializeTaxRule(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    const { taxId } = await context.params;
    const current = await getRule(session.user.companyId, taxId);

    await prisma.taxRule.delete({ where: { id: taxId } });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "taxRule",
      entityId: taxId,
      action: "TAX_RULE_DELETE",
      metadata: { code: current.code },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
