import { prisma } from "@/lib/prisma";

export async function getSimulationCompanyId(liveCompanyId: string) {
  const workspace = await prisma.companyWorkspace.findUnique({
    where: { companyId: liveCompanyId },
    select: { simulationCompanyId: true },
  });
  return workspace?.simulationCompanyId ?? null;
}

export async function ensureSimulationCompany(liveCompanyId: string) {
  const existing = await getSimulationCompanyId(liveCompanyId);
  if (existing) return existing;

  const liveCompany = await prisma.company.findUnique({
    where: { id: liveCompanyId },
    select: {
      id: true,
      name: true,
      currencyCode: true,
      productUnitMode: true,
      defaultProductUnit: true,
      locale: true,
      timezone: true,
    },
  });
  if (!liveCompany) {
    throw new Error("Live company not found");
  }

  return prisma.$transaction(async (tx) => {
    const found = await tx.companyWorkspace.findUnique({
      where: { companyId: liveCompanyId },
      select: { simulationCompanyId: true },
    });
    if (found?.simulationCompanyId) return found.simulationCompanyId;

    const simulationCompanyId = crypto.randomUUID();

    await tx.company.create({
      data: {
        id: simulationCompanyId,
        name: `${liveCompany.name} (Simulation)`,
        currencyCode: liveCompany.currencyCode,
        productUnitMode: liveCompany.productUnitMode,
        defaultProductUnit: liveCompany.defaultProductUnit,
        locale: liveCompany.locale,
        timezone: liveCompany.timezone,
      },
    });

    await tx.companyWorkspace.create({
      data: {
        companyId: liveCompanyId,
        simulationCompanyId,
      },
    });

    const [categories, warehouses, clients, suppliers, taxRules, stockRule, customFields, products] =
      await Promise.all([
        tx.productCategory.findMany({ where: { companyId: liveCompanyId } }),
        tx.warehouse.findMany({ where: { companyId: liveCompanyId } }),
        tx.client.findMany({ where: { companyId: liveCompanyId } }),
        tx.supplier.findMany({ where: { companyId: liveCompanyId } }),
        tx.taxRule.findMany({ where: { companyId: liveCompanyId } }),
        tx.stockRule.findUnique({ where: { companyId: liveCompanyId } }),
        tx.customFieldDefinition.findMany({ where: { companyId: liveCompanyId } }),
        tx.product.findMany({ where: { companyId: liveCompanyId } }),
      ]);

    const categoryMap = new Map<string, string>();
    if (categories.length > 0) {
      for (const category of categories) categoryMap.set(category.id, crypto.randomUUID());
      await tx.productCategory.createMany({
        data: categories.map((category) => ({
          id: categoryMap.get(category.id)!,
          companyId: simulationCompanyId,
          name: category.name,
          description: category.description,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        })),
      });
    }

    if (warehouses.length > 0) {
      await tx.warehouse.createMany({
        data: warehouses.map((warehouse) => ({
          id: crypto.randomUUID(),
          companyId: simulationCompanyId,
          name: warehouse.name,
          location: warehouse.location,
          createdAt: warehouse.createdAt,
          updatedAt: warehouse.updatedAt,
        })),
      });
    }

    if (clients.length > 0) {
      await tx.client.createMany({
        data: clients.map((client) => ({
          id: crypto.randomUUID(),
          companyId: simulationCompanyId,
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: client.address,
          clientType: client.clientType,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
        })),
      });
    }

    if (suppliers.length > 0) {
      await tx.supplier.createMany({
        data: suppliers.map((supplier) => ({
          id: crypto.randomUUID(),
          companyId: simulationCompanyId,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          createdAt: supplier.createdAt,
          updatedAt: supplier.updatedAt,
        })),
      });
    }

    if (taxRules.length > 0) {
      await tx.taxRule.createMany({
        data: taxRules.map((rule) => ({
          id: crypto.randomUUID(),
          companyId: simulationCompanyId,
          code: rule.code,
          label: rule.label,
          rate: rule.rate,
          isDefault: rule.isDefault,
          isActive: rule.isActive,
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        })),
      });
    }

    if (stockRule) {
      await tx.stockRule.create({
        data: {
          id: crypto.randomUUID(),
          companyId: simulationCompanyId,
          allowNegativeStock: stockRule.allowNegativeStock,
          defaultLowStockThreshold: stockRule.defaultLowStockThreshold,
          createdAt: stockRule.createdAt,
          updatedAt: stockRule.updatedAt,
        },
      });
    }

    const customFieldMap = new Map<string, string>();
    if (customFields.length > 0) {
      for (const field of customFields) customFieldMap.set(field.id, crypto.randomUUID());
      await tx.customFieldDefinition.createMany({
        data: customFields.map((field) => ({
          id: customFieldMap.get(field.id)!,
          companyId: simulationCompanyId,
          entityType: field.entityType,
          fieldKey: field.fieldKey,
          label: field.label,
          fieldType: field.fieldType,
          isRequired: field.isRequired,
          createdAt: field.createdAt,
          updatedAt: field.updatedAt,
        })),
      });
    }

    const productMap = new Map<string, string>();
    if (products.length > 0) {
      for (const product of products) productMap.set(product.id, crypto.randomUUID());
      await tx.product.createMany({
        data: products.map((product) => ({
          id: productMap.get(product.id)!,
          companyId: simulationCompanyId,
          sku: product.sku,
          name: product.name,
          description: product.description,
          categoryId: product.categoryId ? categoryMap.get(product.categoryId) ?? null : null,
          unitPrice: product.unitPrice,
          unitOfMeasure: product.unitOfMeasure,
          isActive: product.isActive,
          lowStockThreshold: product.lowStockThreshold,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        })),
      });

      const productCustomValues = await tx.customFieldValue.findMany({
        where: { companyId: liveCompanyId, productId: { in: products.map((p) => p.id) } },
      });
      if (productCustomValues.length > 0) {
        await tx.customFieldValue.createMany({
          data: productCustomValues
            .map((value) => {
              const mappedProductId = value.productId ? productMap.get(value.productId) : null;
              const mappedFieldId = customFieldMap.get(value.fieldId);
              if (!mappedProductId || !mappedFieldId) return null;
              return {
                id: crypto.randomUUID(),
                companyId: simulationCompanyId,
                recordId: mappedProductId,
                entityType: value.entityType,
                fieldId: mappedFieldId,
                productId: mappedProductId,
                value: value.value,
                createdAt: value.createdAt,
                updatedAt: value.updatedAt,
              };
            })
            .filter((value): value is NonNullable<typeof value> => value !== null),
        });
      }
    }

    return simulationCompanyId;
  });
}
