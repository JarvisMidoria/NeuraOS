import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import { decimalToString, requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";

async function getOrCreate(companyId: string) {
  return prisma.stockRule.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    const rule = await getOrCreate(session.user.companyId);
    return NextResponse.json({
      data: {
        id: rule.id,
        companyId: rule.companyId,
        allowNegativeStock: rule.allowNegativeStock,
        defaultLowStockThreshold: decimalToString(rule.defaultLowStockThreshold),
        updatedAt: rule.updatedAt,
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

    if (body.defaultLowStockThreshold !== undefined && body.defaultLowStockThreshold !== null) {
      const n = Number(body.defaultLowStockThreshold);
      if (!Number.isFinite(n) || n < 0) {
        throw new ApiError(400, "defaultLowStockThreshold must be a positive number");
      }
    }

    const updated = await prisma.stockRule.upsert({
      where: { companyId: session.user.companyId },
      create: {
        companyId: session.user.companyId,
        allowNegativeStock: Boolean(body.allowNegativeStock),
        defaultLowStockThreshold:
          body.defaultLowStockThreshold === undefined || body.defaultLowStockThreshold === null
            ? null
            : new Prisma.Decimal(body.defaultLowStockThreshold),
      },
      update: {
        ...(body.allowNegativeStock !== undefined ? { allowNegativeStock: Boolean(body.allowNegativeStock) } : {}),
        ...(body.defaultLowStockThreshold !== undefined
          ? {
              defaultLowStockThreshold:
                body.defaultLowStockThreshold === null
                  ? null
                  : new Prisma.Decimal(body.defaultLowStockThreshold),
            }
          : {}),
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "stockRule",
      entityId: updated.id,
      action: "STOCK_RULE_UPDATE",
      metadata: {
        allowNegativeStock: updated.allowNegativeStock,
        defaultLowStockThreshold: decimalToString(updated.defaultLowStockThreshold),
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        allowNegativeStock: updated.allowNegativeStock,
        defaultLowStockThreshold: decimalToString(updated.defaultLowStockThreshold),
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
