import { PrismaClient, Prisma, DocumentStatus, StockMovementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.$transaction([
    prisma.customFieldValue.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.tenantSubscription.deleteMany(),
    prisma.salesOrderTaxLine.deleteMany(),
    prisma.salesOrderLine.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.salesQuoteTaxLine.deleteMany(),
    prisma.salesQuoteLine.deleteMany(),
    prisma.goodsReceiptLine.deleteMany(),
    prisma.purchaseOrderTaxLine.deleteMany(),
    prisma.purchaseOrderLine.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.goodsReceipt.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.salesQuote.deleteMany(),
    prisma.product.deleteMany(),
    prisma.productCategory.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.client.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.customFieldDefinition.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.company.deleteMany(),
  ]);
}

async function main() {
  await resetDatabase();

  const company = await prisma.company.create({
    data: {
      name: "Acme Manufacturing",
      domain: "acme.local",
    },
  });

  await prisma.tenantSubscription.create({
    data: {
      companyId: company.id,
      plan: "GROWTH",
      status: "ACTIVE",
      seatLimit: 25,
      billingEmail: "billing@acme.local",
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const permissionCodes = [
    { code: "VIEW_DASHBOARD", description: "Access dashboards" },
    { code: "MANAGE_PRODUCTS", description: "Create and edit products" },
    { code: "MANAGE_PURCHASING", description: "Handle POs and receipts" },
    { code: "MANAGE_SALES", description: "Handle quotes" },
    { code: "MANAGE_WAREHOUSE", description: "Adjust stock" },
    { code: "ADMIN", description: "Full administrative rights" },
  ];

  const permissions = await Promise.all(
    permissionCodes.map((perm) =>
      prisma.permission.create({
        data: {
          companyId: company.id,
          code: perm.code,
          description: perm.description,
        },
      })
    )
  );

  const adminRole = await prisma.role.create({
    data: {
      companyId: company.id,
      name: "Admin",
      description: "System administrator",
    },
  });

  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.create({
        data: {
          companyId: company.id,
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
    )
  );

  const passwordHash = await bcrypt.hash("admin123", 10);

  const adminUser = await prisma.user.create({
    data: {
      companyId: company.id,
      email: "admin@acme.local",
      name: "Acme Admin",
      passwordHash,
    },
  });

  await prisma.userRole.create({
    data: {
      companyId: company.id,
      roleId: adminRole.id,
      userId: adminUser.id,
    },
  });

  const [rawMaterials, finishedGoods] = await prisma.$transaction([
    prisma.productCategory.create({
      data: {
        companyId: company.id,
        name: "Raw Materials",
      },
    }),
    prisma.productCategory.create({
      data: {
        companyId: company.id,
        name: "Finished Goods",
      },
    }),
  ]);

  const warehouses = await prisma.$transaction([
    prisma.warehouse.create({
      data: {
        companyId: company.id,
        name: "Main Warehouse",
        location: "Building A",
      },
    }),
    prisma.warehouse.create({
      data: {
        companyId: company.id,
        name: "Overflow Warehouse",
        location: "Building B",
      },
    }),
  ]);

  const products = await prisma.$transaction([
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: rawMaterials.id,
        sku: "RM-ALUM-001",
        name: "Aluminum Sheets",
        description: "4x8 industrial aluminum sheets",
        unitPrice: new Prisma.Decimal(35.5),
        unitOfMeasure: "SHEET",
        lowStockThreshold: new Prisma.Decimal(50),
      },
    }),
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: finishedGoods.id,
        sku: "FG-PNL-001",
        name: "Control Panel",
        description: "Industrial control panel",
        unitPrice: new Prisma.Decimal(1299.99),
        lowStockThreshold: new Prisma.Decimal(5),
      },
    }),
    prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: finishedGoods.id,
        sku: "FG-PMP-002",
        name: "Hydraulic Pump",
        description: "Compact hydraulic pump",
        unitPrice: new Prisma.Decimal(899.0),
        lowStockThreshold: new Prisma.Decimal(8),
      },
    }),
  ]);

  const [client, supplier] = await prisma.$transaction([
    prisma.client.create({
      data: {
        companyId: company.id,
        name: "Northwind Energy",
        email: "purchasing@northwind.energy",
        phone: "+1-555-0101",
      },
    }),
    prisma.supplier.create({
      data: {
        companyId: company.id,
        name: "Precision Metals",
        email: "sales@precisionmetals.io",
        phone: "+1-555-0202",
      },
    }),
  ]);

  const productCustomFields = await prisma.$transaction([
    prisma.customFieldDefinition.create({
      data: {
        companyId: company.id,
        entityType: "product",
        fieldKey: "color",
        label: "Color",
        fieldType: "text",
      },
    }),
    prisma.customFieldDefinition.create({
      data: {
        companyId: company.id,
        entityType: "product",
        fieldKey: "voltage",
        label: "Voltage",
        fieldType: "number",
      },
    }),
  ]);

  await prisma.$transaction([
    prisma.customFieldValue.create({
      data: {
        companyId: company.id,
        entityType: "product",
        recordId: products[1].id,
        productId: products[1].id,
        fieldId: productCustomFields[0].id,
        value: "Gray",
      },
    }),
    prisma.customFieldValue.create({
      data: {
        companyId: company.id,
        entityType: "product",
        recordId: products[1].id,
        productId: products[1].id,
        fieldId: productCustomFields[1].id,
        value: "220",
      },
    }),
  ]);

  await prisma.stockMovement.createMany({
    data: [
      {
        companyId: company.id,
        productId: products[0].id,
        warehouseId: warehouses[0].id,
        movementType: StockMovementType.INBOUND,
        quantity: new Prisma.Decimal(100),
        reference: "PO-1001",
        movementDate: new Date(),
      },
      {
        companyId: company.id,
        productId: products[1].id,
        warehouseId: warehouses[0].id,
        movementType: StockMovementType.INBOUND,
        quantity: new Prisma.Decimal(25),
        reference: "PO-1002",
        movementDate: new Date(),
      },
      {
        companyId: company.id,
        productId: products[1].id,
        warehouseId: warehouses[1].id,
        movementType: StockMovementType.OUTBOUND,
        quantity: new Prisma.Decimal(5),
        reference: "QUOTE-5001",
        movementDate: new Date(),
      },
    ],
  });

  const salesQuote = await prisma.salesQuote.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      quoteNumber: 5001,
      quoteDate: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: DocumentStatus.SENT,
      subtotalAmount: new Prisma.Decimal(6499.95),
      taxAmount: new Prisma.Decimal(1299.99),
      totalAmount: new Prisma.Decimal(7799.94),
      createdById: adminUser.id,
      lines: {
        create: [
          {
            productId: products[1].id,
            warehouseId: warehouses[0].id,
            description: "Custom control panels",
            quantity: new Prisma.Decimal(5),
            unitPrice: new Prisma.Decimal(1299.99),
            lineTotal: new Prisma.Decimal(6499.95),
          },
        ],
      },
      taxLines: {
        create: [
          {
            label: "TVA 20%",
            taxCode: "TVA20",
            rate: new Prisma.Decimal(20),
            baseAmount: new Prisma.Decimal(6499.95),
            taxAmount: new Prisma.Decimal(1299.99),
          },
        ],
      },
    },
  });

  const seedOrder = await prisma.salesOrder.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      orderNumber: 6001,
      orderDate: new Date(),
      status: DocumentStatus.APPROVED,
      subtotalAmount: new Prisma.Decimal(2599.98),
      taxAmount: new Prisma.Decimal(520),
      totalAmount: new Prisma.Decimal(3119.98),
      createdById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
      lines: {
        create: [
          {
            productId: products[2].id,
            warehouseId: warehouses[1].id,
            description: "Hydraulic pumps",
            quantity: new Prisma.Decimal(2),
            unitPrice: new Prisma.Decimal(1299.99),
            lineTotal: new Prisma.Decimal(2599.98),
          },
        ],
      },
      taxLines: {
        create: [
          {
            label: "TVA 20%",
            taxCode: "TVA20",
            rate: new Prisma.Decimal(20),
            baseAmount: new Prisma.Decimal(2599.98),
            taxAmount: new Prisma.Decimal(520),
          },
        ],
      },
    },
  });

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      companyId: company.id,
      supplierId: supplier.id,
      poNumber: 7001,
      orderDate: new Date(),
      expectedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: DocumentStatus.CONFIRMED,
      subtotalAmount: new Prisma.Decimal(7100),
      taxAmount: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(7100),
      notes: "Initial restock",
      lines: {
        create: [
          {
            productId: products[0].id,
            quantity: new Prisma.Decimal(200),
            unitPrice: new Prisma.Decimal(35.5),
            lineTotal: new Prisma.Decimal(7100),
          },
        ],
      },
    },
    include: { lines: true },
  });

  await prisma.goodsReceipt.create({
    data: {
      companyId: company.id,
      purchaseOrderId: purchaseOrder.id,
      warehouseId: warehouses[0].id,
      receiptNumber: 8001,
      receivedDate: new Date(),
      status: DocumentStatus.PARTIALLY_RECEIVED,
      lines: {
        create: [
          {
            purchaseOrderLineId: purchaseOrder.lines[0].id,
            productId: products[0].id,
            warehouseId: warehouses[0].id,
            quantity: new Prisma.Decimal(120),
            unitPrice: new Prisma.Decimal(35.5),
            lineTotal: new Prisma.Decimal(4260),
          },
        ],
      },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        companyId: company.id,
        userId: adminUser.id,
        action: "LOGIN",
        entity: "user",
        entityId: adminUser.id,
      },
      {
        companyId: company.id,
        userId: adminUser.id,
        action: "CREATE_QUOTE",
        entity: "salesQuote",
        entityId: salesQuote.id,
      },
      {
        companyId: company.id,
        userId: adminUser.id,
        action: "SALES_ORDER_CREATED",
        entity: "salesOrder",
        entityId: seedOrder.id,
        metadata: { orderNumber: 6001 },
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
