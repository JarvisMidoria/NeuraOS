import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, ensureRoles, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { enforcePlanLimit } from "@/lib/subscription-limits";

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

type ProductPayload = {
  sku?: string;
  name?: string;
  description?: string | null;
  unitPrice?: string | number;
  unitOfMeasure?: string;
  categoryId?: string | null;
  lowStockThreshold?: string | number | null;
  customFieldValues?: CustomFieldInput[];
};

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
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "10");
    const categoryId = searchParams.get("categoryId");

    const where = {
      companyId: session.user.companyId,
      ...(categoryId ? { categoryId } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          customValues: {
            include: { definition: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      data: products.map(serializeProduct),
      page,
      pageSize,
      total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin"]);
    await enforcePlanLimit(session.user.companyId, "products");

    const body = (await req.json()) as ProductPayload;
    const {
      sku,
      name,
      description,
      unitPrice,
      unitOfMeasure = "EA",
      categoryId,
      lowStockThreshold,
      customFieldValues,
    } = body;

    if (!sku || !name || unitPrice === undefined) {
      throw new ApiError(400, "Missing required fields");
    }

    const unitPriceDecimal = new Prisma.Decimal(unitPrice);
    const lowStockDecimal =
      lowStockThreshold !== undefined && lowStockThreshold !== null && lowStockThreshold !== ""
        ? new Prisma.Decimal(lowStockThreshold)
        : null;

    const companyId = session.user.companyId;

    if (categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: { id: categoryId, companyId },
      });
      if (!category) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          companyId,
          sku,
          name,
          description,
          unitPrice: unitPriceDecimal,
          unitOfMeasure,
          categoryId: categoryId ?? null,
          lowStockThreshold: lowStockDecimal,
        },
        include: {
          category: true,
          customValues: { include: { definition: true } },
        },
      });

      if (Array.isArray(customFieldValues) && customFieldValues.length) {
        const fields = customFieldValues as CustomFieldInput[];
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
        const valuesToCreate = fields
          .filter(
            (field) =>
              allowedIds.has(field.fieldId) && field.value !== undefined && field.value !== "",
          )
          .map((field) => ({
            companyId,
            recordId: created.id,
            productId: created.id,
            entityType: "product",
            fieldId: field.fieldId,
            value: String(field.value ?? ""),
          }));

        if (valuesToCreate.length) {
          await tx.customFieldValue.createMany({ data: valuesToCreate });
        }
      }

      return created;
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "product",
      entityId: product.id,
      action: "PRODUCT_CREATE",
      metadata: { sku: product.sku, name: product.name },
    });

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        customValues: { include: { definition: true } },
      },
    });

    if (!fullProduct) {
      throw new ApiError(404, "Product not found after creation");
    }

    return NextResponse.json({ data: serializeProduct(fullProduct) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
