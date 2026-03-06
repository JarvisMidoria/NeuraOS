import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { decimalToString, requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";

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

export async function GET() {
  try {
    const session = await requireAdminSession();
    const rules = await prisma.taxRule.findMany({
      where: { companyId: session.user.companyId },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
    });

    return NextResponse.json({ data: rules.map(serializeTaxRule) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();

    const code = String(body.code ?? "").trim().toUpperCase();
    const label = String(body.label ?? "").trim();
    const rate = Number(body.rate);

    if (!code) throw new ApiError(400, "code is required");
    if (!label) throw new ApiError(400, "label is required");
    if (!Number.isFinite(rate) || rate < 0) throw new ApiError(400, "rate is invalid");

    const tax = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.taxRule.updateMany({
          where: { companyId: session.user.companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.taxRule.create({
        data: {
          companyId: session.user.companyId,
          code,
          label,
          rate: new Prisma.Decimal(rate),
          isDefault: Boolean(body.isDefault),
          isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        },
      });
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "taxRule",
      entityId: tax.id,
      action: "TAX_RULE_CREATE",
      metadata: { code: tax.code },
    });

    return NextResponse.json({ data: serializeTaxRule(tax) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
