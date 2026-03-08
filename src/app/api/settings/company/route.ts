import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma, ProductUnitMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-helpers";
import { requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";
import { ALLOWED_CURRENCY_CODES } from "@/lib/currency";

const ALLOWED_PRODUCT_UNITS = new Set(["EA", "M", "L", "KG"]);
const ALLOWED_PRODUCT_UNIT_MODES = new Set(["GLOBAL", "PER_PRODUCT"]);

function normalizeProductUnit(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (raw === "EA" || raw === "EACH" || raw === "UNIT" || raw === "UNITS") return "EA";
  if (raw === "M" || raw === "METER" || raw === "METERS" || raw === "METRE" || raw === "METRES") return "M";
  if (raw === "L" || raw === "LITER" || raw === "LITERS" || raw === "LITRE" || raw === "LITRES") return "L";
  if (raw === "KG" || raw === "KGS" || raw === "KILOGRAM" || raw === "KILOGRAMS") return "KG";
  return raw;
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        id: true,
        name: true,
        domain: true,
        currencyCode: true,
        productUnitMode: true,
        defaultProductUnit: true,
        locale: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) throw new ApiError(404, "Company not found");
    return NextResponse.json({ data: company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();

    const data = {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.domain !== undefined ? { domain: body.domain ? String(body.domain).trim() : null } : {}),
      ...(body.currencyCode !== undefined ? { currencyCode: String(body.currencyCode).toUpperCase() } : {}),
      ...(body.productUnitMode !== undefined
        ? {
            productUnitMode:
              String(body.productUnitMode).toUpperCase() === "GLOBAL"
                ? ProductUnitMode.GLOBAL
                : ProductUnitMode.PER_PRODUCT,
          }
        : {}),
      ...(body.defaultProductUnit !== undefined ? { defaultProductUnit: normalizeProductUnit(body.defaultProductUnit) } : {}),
      ...(body.locale !== undefined ? { locale: String(body.locale) } : {}),
      ...(body.timezone !== undefined ? { timezone: String(body.timezone) } : {}),
    };

    if ("name" in data && !data.name) throw new ApiError(400, "name is required");
    if (
      typeof data.currencyCode === "string" &&
      !ALLOWED_CURRENCY_CODES.includes(data.currencyCode as (typeof ALLOWED_CURRENCY_CODES)[number])
    ) {
      throw new ApiError(400, "currencyCode must be one of EUR, USD, MAD");
    }
    if (
      typeof data.productUnitMode === "string" &&
      !ALLOWED_PRODUCT_UNIT_MODES.has(data.productUnitMode)
    ) {
      throw new ApiError(400, "productUnitMode must be GLOBAL or PER_PRODUCT");
    }
    if (
      typeof data.defaultProductUnit === "string" &&
      !ALLOWED_PRODUCT_UNITS.has(data.defaultProductUnit)
    ) {
      throw new ApiError(400, "defaultProductUnit must be one of EA, M, L, KG");
    }

    const company = await prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: session.user.companyId },
        data,
        select: {
          id: true,
          name: true,
          domain: true,
          currencyCode: true,
          productUnitMode: true,
          defaultProductUnit: true,
          locale: true,
          timezone: true,
          updatedAt: true,
        },
      });

      if (updated.productUnitMode === ProductUnitMode.GLOBAL) {
        await tx.product.updateMany({
          where: { companyId: session.user.companyId },
          data: { unitOfMeasure: updated.defaultProductUnit },
        });
      }

      return updated;
    });

    try {
      await logAudit({
        companyId: session.user.companyId,
        userId: session.user.id,
        entity: "company",
        entityId: company.id,
        action: "COMPANY_SETTINGS_UPDATE",
        metadata: { updatedKeys: Object.keys(data) },
      });
    } catch (auditError) {
      console.error("audit log failed on company settings update", auditError);
    }

    return NextResponse.json({ data: company });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return handleApiError(new ApiError(409, "A unique field value already exists", { code: error.code, meta: error.meta }));
      }
      return handleApiError(new ApiError(400, "Database validation failed", { code: error.code, meta: error.meta }));
    }
    return handleApiError(error);
  }
}
