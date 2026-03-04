import type { Prisma } from "@prisma/client";
import { DocumentStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { getCurrentStock } from "@/lib/stock-service";
import { getNextOrderNumber } from "@/lib/sales/sequencing";
import { logAudit } from "@/lib/audit";

export type ConvertQuoteParams = {
  quoteId: string;
  companyId: string;
  userId: string;
};

type ConversionDependencies = {
  getStock: (
    companyId: string,
    productId: string,
    warehouseId: string,
    db: Prisma.TransactionClient,
  ) => Promise<Prisma.Decimal>;
  nextOrderNumber: (tx: Prisma.TransactionClient, companyId: string) => Promise<number>;
  audit: typeof logAudit;
};

const defaultDeps: ConversionDependencies = {
  getStock: getCurrentStock,
  nextOrderNumber: getNextOrderNumber,
  audit: logAudit,
};

export async function convertQuoteToOrder(
  params: ConvertQuoteParams,
  db: PrismaClient = prisma,
  deps: ConversionDependencies = defaultDeps,
) {
  return db.$transaction((tx) => convertQuoteToOrderWithTx(tx, params, deps));
}

export async function convertQuoteToOrderWithTx(
  tx: Prisma.TransactionClient,
  params: ConvertQuoteParams,
  deps: ConversionDependencies = defaultDeps,
) {
  const quote = await tx.salesQuote.findFirst({
    where: {
      id: params.quoteId,
      companyId: params.companyId,
    },
    include: {
      lines: true,
      taxLines: true,
      convertedOrder: true,
    },
  });

  if (!quote) {
    throw new ApiError(404, "Quote not found");
  }

  if (quote.convertedOrder) {
    throw new ApiError(400, "Quote already converted to order");
  }

  if (quote.status !== DocumentStatus.APPROVED) {
    throw new ApiError(400, "Only approved quotes can be converted");
  }

  if (!quote.lines.length) {
    throw new ApiError(400, "Quote has no lines to convert");
  }

  const missingWarehouse = quote.lines.find((line) => !line.warehouseId);
  if (missingWarehouse) {
    throw new ApiError(400, "All quote lines must have a warehouse before conversion");
  }

  const insufficient: Array<{ lineId: string; productId: string; warehouseId: string; available: string }> = [];

  for (const line of quote.lines) {
    const available = await deps.getStock(
      quote.companyId,
      line.productId,
      line.warehouseId!,
      tx,
    );
    if (available.lt(line.quantity)) {
      insufficient.push({
        lineId: line.id,
        productId: line.productId,
        warehouseId: line.warehouseId!,
        available: available.toString(),
      });
    }
  }

  if (insufficient.length) {
    throw new ApiError(409, "Insufficient stock for one or more lines", {
      insufficient,
    });
  }

  const orderNumber = await deps.nextOrderNumber(tx, quote.companyId);

  const order = await tx.salesOrder.create({
    data: {
      companyId: quote.companyId,
      clientId: quote.clientId,
      salesQuoteId: quote.id,
      orderNumber,
      orderDate: new Date(),
      status: DocumentStatus.DRAFT,
      subtotalAmount: quote.subtotalAmount,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      notes: quote.notes,
      createdById: params.userId,
      lines: {
        create: quote.lines.map((line) => ({
          productId: line.productId,
          warehouseId: line.warehouseId!,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        })),
      },
      taxLines: {
        create: quote.taxLines.map((taxLine) => ({
          label: taxLine.label,
          taxCode: taxLine.taxCode,
          rate: taxLine.rate,
          baseAmount: taxLine.baseAmount,
          taxAmount: taxLine.taxAmount,
        })),
      },
    },
  });

  await tx.salesQuote.update({
    where: { id: quote.id },
    data: { status: DocumentStatus.CONVERTED },
  });

  await deps.audit({
    companyId: quote.companyId,
    userId: params.userId,
    entity: "salesQuote",
    entityId: quote.id,
    action: "QUOTE_CONVERTED",
    metadata: { orderId: order.id, orderNumber },
  });

  await deps.audit({
    companyId: quote.companyId,
    userId: params.userId,
    entity: "salesOrder",
    entityId: order.id,
    action: "SALES_ORDER_CREATED",
    metadata: { quoteId: quote.id, orderNumber },
  });

  return order;
}
