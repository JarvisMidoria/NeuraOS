import { DocumentStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";

export type OrderLineState = {
  id: string;
  productId: string;
  unitPrice: Prisma.Decimal;
  orderedQuantity: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
};

export type ReceiptLineInput = {
  purchaseOrderLineId: string;
  productId: string;
  warehouseId: string;
  quantity: number | string;
  unitPrice?: number | string;
};

export type ReceiptPlanResult = {
  lines: Array<{
    purchaseOrderLineId: string;
    productId: string;
    warehouseId: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
  stockMovements: Array<{
    productId: string;
    warehouseId: string;
    quantity: Prisma.Decimal;
  }>;
  overrideUsed: boolean;
  resultingStatus: DocumentStatus;
};

const ZERO = new Prisma.Decimal(0);

function toDecimal(value: number | string | Prisma.Decimal | undefined, field: string) {
  if (value === undefined || value === null || value === "") {
    throw new ApiError(400, `${field} is required`);
  }

  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new ApiError(400, `${field} is not a valid number`);
  }
}

export function buildReceiptPlan(
  orderLines: OrderLineState[],
  inputs: ReceiptLineInput[],
  options: { allowOverReceive?: boolean } = {},
): ReceiptPlanResult {
  if (!orderLines.length) {
    throw new ApiError(400, "Purchase order has no lines");
  }

  if (!inputs.length) {
    throw new ApiError(400, "At least one goods receipt line is required");
  }

  const reference = new Map(orderLines.map((line) => [line.id, line]));
  const preparedLines: ReceiptPlanResult["lines"] = [];
  const stockMovements: ReceiptPlanResult["stockMovements"] = [];
  let overrideUsed = false;

  const cumulative = new Map(
    orderLines.map((line) => [line.id, line.receivedQuantity]),
  );

  inputs.forEach((input, index) => {
    const ctx = reference.get(input.purchaseOrderLineId);
    if (!ctx) {
      throw new ApiError(400, `lines[${index}] references an unknown purchase order line`);
    }

    if (ctx.productId !== input.productId) {
      throw new ApiError(400, `lines[${index}] product does not match purchase order line`);
    }

    if (!input.warehouseId) {
      throw new ApiError(400, `lines[${index}].warehouseId is required`);
    }

    const quantity = toDecimal(input.quantity, `lines[${index}].quantity`);
    if (quantity.lte(ZERO)) {
      throw new ApiError(400, `lines[${index}].quantity must be greater than zero`);
    }

    const unitPrice =
      input.unitPrice !== undefined && input.unitPrice !== null && input.unitPrice !== ""
        ? toDecimal(input.unitPrice, `lines[${index}].unitPrice`)
        : ctx.unitPrice;

    const receivedSoFar = cumulative.get(ctx.id) ?? ZERO;
    const ordered = ctx.orderedQuantity;
    const pending = ordered.sub(receivedSoFar);

    if (quantity.gt(pending)) {
      if (!options.allowOverReceive) {
        throw new ApiError(409, "Over-receipt is not allowed", {
          lineId: ctx.id,
          ordered: ordered.toString(),
          receivedToDate: receivedSoFar.toString(),
          attempted: quantity.toString(),
        });
      }
      overrideUsed = true;
    }

    const newReceived = receivedSoFar.add(quantity);
    cumulative.set(ctx.id, newReceived);

    const lineTotal = quantity.mul(unitPrice);
    preparedLines.push({
      purchaseOrderLineId: ctx.id,
      productId: ctx.productId,
      warehouseId: input.warehouseId,
      quantity,
      unitPrice,
      lineTotal,
    });
    stockMovements.push({
      productId: ctx.productId,
      warehouseId: input.warehouseId,
      quantity,
    });
  });

  const fullyReceived = orderLines.every((line) => {
    const received = cumulative.get(line.id) ?? ZERO;
    return received.gte(line.orderedQuantity);
  });

  return {
    lines: preparedLines,
    stockMovements,
    overrideUsed,
    resultingStatus: fullyReceived ? DocumentStatus.RECEIVED : DocumentStatus.PARTIALLY_RECEIVED,
  };
}
