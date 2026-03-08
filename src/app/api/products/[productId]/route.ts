import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, ensureRoles, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    customValues: {
      include: { definition: true };
    };
  };
}>;

type CustomFieldInput = {
  fieldId: string;
  value?: string | number | null;
};

type ProductUpdatePayload = {
  name?: string;
  description?: string | null;
  unitPrice?: string | number;
  unitOfMeasure?: string;
  isActive?: boolean;
  lowStockThreshold?: string | number | null;
  categoryId?: string | null;
  customFieldValues?: CustomFieldInput[];
};

const ALLOWED_PRODUCT_UNITS = new Set(["EA", "M", "L", "KG"]);

interface RouteContext {
  params: Promise<{ productId: string }>;
}

function serializeProduct(product: ProductWithRelations | null) {
  if (!product) return null;
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    unitPrice: product.unitPrice.toString(),
    unitOfMeasure: product.unitOfMeasure,
    isActive: product.isActive,
    lowStockThreshold: product.lowStockThreshold?.toString() ?? null,
    category: product.category
      ? { id: product.category.id, name: product.category.name }
      : null,
    customFields: product.customValues.map((value) => ({
      id: value.id,
      fieldId: value.fieldId,
      fieldKey: value.definition.fieldKey,
      label: value.definition.label,
      value: value.value,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);
    const { productId } = await context.params;

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: session.user.companyId },
      include: {
        category: true,
        customValues: { include: { definition: true } },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    return NextResponse.json({ data: serializeProduct(product) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);
    const { productId } = await context.params;

    const body = (await req.json()) as ProductUpdatePayload;
    const companyId = session.user.companyId;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { productUnitMode: true, defaultProductUnit: true },
    });
    if (!company) throw new ApiError(404, "Company not found");

    const { product: updated, beforeSnapshot } = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({ where: { id: productId, companyId } });

      if (!existing) {
        throw new ApiError(404, "Product not found");
      }

      const beforeSnapshot = {
        sku: existing.sku,
        name: existing.name,
      };

      const data: Prisma.ProductUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.unitPrice !== undefined) data.unitPrice = new Prisma.Decimal(body.unitPrice);
      if (body.unitOfMeasure !== undefined) {
        const requestedUnit = String(body.unitOfMeasure).trim().toUpperCase();
        if (company.productUnitMode === "GLOBAL") {
          data.unitOfMeasure = company.defaultProductUnit;
        } else {
          if (!ALLOWED_PRODUCT_UNITS.has(requestedUnit)) {
            throw new ApiError(400, "unitOfMeasure must be one of EA, M, L, KG");
          }
          data.unitOfMeasure = requestedUnit;
        }
      } else if (company.productUnitMode === "GLOBAL") {
        data.unitOfMeasure = company.defaultProductUnit;
      }
      if (body.isActive !== undefined) data.isActive = !!body.isActive;
      if (body.lowStockThreshold !== undefined) {
        data.lowStockThreshold = body.lowStockThreshold === null || body.lowStockThreshold === ""
          ? null
          : new Prisma.Decimal(body.lowStockThreshold);
      }
      if (body.categoryId !== undefined) {
        if (body.categoryId === null || body.categoryId === "") {
          data.category = { disconnect: true };
        } else {
          const category = await tx.productCategory.findFirst({
            where: { id: body.categoryId, companyId },
          });
          if (!category) {
            throw new ApiError(400, "Invalid category");
          }
          data.category = { connect: { id: body.categoryId } };
        }
      }

      await tx.product.update({
        where: { id: existing.id },
        data,
      });

      if (Array.isArray(body.customFieldValues)) {
        const fields = body.customFieldValues as CustomFieldInput[];
        await tx.customFieldValue.deleteMany({
          where: {
            companyId,
            productId: existing.id,
          },
        });

        if (fields.length) {
          const fieldIds = fields.map((field) => field.fieldId);
          const definitions = await tx.customFieldDefinition.findMany({
            where: {
              companyId,
              entityType: "product",
              id: { in: fieldIds },
            },
            select: { id: true },
          });
          const allowedIds = new Set(definitions.map((def) => def.id));
          const values = fields
            .filter(
              (field) =>
                allowedIds.has(field.fieldId) && field.value !== undefined && field.value !== "",
            )
            .map((field) => ({
              companyId,
              recordId: existing.id,
              productId: existing.id,
              entityType: "product",
              fieldId: field.fieldId,
              value: String(field.value ?? ""),
            }));
          if (values.length) {
            await tx.customFieldValue.createMany({ data: values });
          }
        }
      }

      const refreshed = await tx.product.findUnique({
        where: { id: existing.id },
        include: {
          category: true,
          customValues: { include: { definition: true } },
        },
      });

      if (!refreshed) {
        throw new ApiError(404, "Product not found after update");
      }

      return { product: refreshed, beforeSnapshot };
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "product",
      entityId: updated.id,
      action: "PRODUCT_UPDATE",
      metadata: {
        before: beforeSnapshot,
        after: { sku: updated.sku, name: updated.name },
      },
    });

    return NextResponse.json({ data: serializeProduct(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);
    const companyId = session.user.companyId;
    const { productId } = await context.params;

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.customFieldValue.deleteMany({
        where: { companyId, productId: product.id },
      });
      await tx.product.delete({ where: { id: product.id } });
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "product",
      entityId: product.id,
      action: "PRODUCT_DELETE",
      metadata: { before: { sku: product.sku, name: product.name }, after: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
