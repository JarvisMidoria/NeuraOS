import { Prisma } from "@prisma/client";

export type PurchaseLineTaxInput = {
  label?: string;
  taxCode?: string;
  rate: number | string;
};

export type PurchaseLineInput = {
  productId: string;
  quantity: number | string;
  unitPrice: number | string;
  taxes?: PurchaseLineTaxInput[];
};

export type PreparedPurchaseLine = {
  productId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

export type PreparedPurchaseTaxLine = {
  label: string;
  taxCode?: string;
  rate: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
};

export interface PreparedPurchasePayload {
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  lines: PreparedPurchaseLine[];
  taxLines: PreparedPurchaseTaxLine[];
}

const ZERO = new Prisma.Decimal(0);

function toDecimal(value: number | string | Prisma.Decimal | undefined, field: string) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${field} is required`);
  }
  try {
    return new Prisma.Decimal(value);
  } catch (error) {
    throw new Error(`${field} is not a valid number`);
  }
}

export function preparePurchasePayload(lines: PurchaseLineInput[]): PreparedPurchasePayload {
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error("At least one line is required");
  }

  const preparedLines: PreparedPurchaseLine[] = [];
  const taxMap = new Map<string, PreparedPurchaseTaxLine>();
  let subtotal = ZERO;

  lines.forEach((line, index) => {
    const quantity = toDecimal(line.quantity, `lines[${index}].quantity`);
    const unitPrice = toDecimal(line.unitPrice, `lines[${index}].unitPrice`);

    if (quantity.lte(ZERO)) {
      throw new Error(`lines[${index}].quantity must be greater than zero`);
    }

    if (unitPrice.lt(ZERO)) {
      throw new Error(`lines[${index}].unitPrice cannot be negative`);
    }

    const lineTotal = quantity.mul(unitPrice);
    subtotal = subtotal.add(lineTotal);

    preparedLines.push({
      productId: line.productId,
      quantity,
      unitPrice,
      lineTotal,
    });

    if (Array.isArray(line.taxes)) {
      line.taxes.forEach((tax, taxIndex) => {
        const rate = toDecimal(tax.rate, `lines[${index}].taxes[${taxIndex}].rate`);
        if (rate.lte(ZERO)) {
          return;
        }

        const taxAmount = lineTotal.mul(rate).div(100);
        const key = `${tax.taxCode ?? tax.label ?? "TAX"}:${rate.toString()}`;
        const existing = taxMap.get(key);
        const baseAmount = (existing?.baseAmount ?? ZERO).add(lineTotal);
        const accumulated = (existing?.taxAmount ?? ZERO).add(taxAmount);

        taxMap.set(key, {
          label: tax.label ?? `${rate.toString()}% TVA`,
          taxCode: tax.taxCode,
          rate,
          baseAmount,
          taxAmount: accumulated,
        });
      });
    }
  });

  const taxLines = Array.from(taxMap.values());
  const taxTotal = taxLines.reduce((acc, entry) => acc.add(entry.taxAmount), ZERO);

  return {
    subtotal,
    taxTotal,
    lines: preparedLines,
    taxLines,
  };
}
