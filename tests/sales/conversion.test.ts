import { describe, expect, it, vi } from "vitest";
import { DocumentStatus, Prisma } from "@prisma/client";
import { convertQuoteToOrderWithTx } from "@/lib/sales/conversion";
import { ApiError } from "@/lib/api-helpers";

type MockTx = {
  salesQuote: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  salesOrder: {
    create: ReturnType<typeof vi.fn>;
  };
};

function buildQuote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "quote-1",
    companyId: "company-1",
    clientId: "client-1",
    status: DocumentStatus.APPROVED,
    subtotalAmount: new Prisma.Decimal(100),
    taxAmount: new Prisma.Decimal(20),
    totalAmount: new Prisma.Decimal(120),
    notes: null,
    convertedOrder: null,
    lines: [
      {
        id: "line-1",
        productId: "product-1",
        warehouseId: "warehouse-1",
        description: null,
        quantity: new Prisma.Decimal(2),
        unitPrice: new Prisma.Decimal(50),
        lineTotal: new Prisma.Decimal(100),
      },
    ],
    taxLines: [
      {
        id: "tax-1",
        label: "TVA",
        taxCode: "TVA20",
        rate: new Prisma.Decimal(20),
        baseAmount: new Prisma.Decimal(100),
        taxAmount: new Prisma.Decimal(20),
      },
    ],
    ...overrides,
  };
}

function buildTx(quote: ReturnType<typeof buildQuote>): MockTx {
  return {
    salesQuote: {
      findFirst: vi.fn().mockResolvedValue(quote),
      update: vi.fn().mockResolvedValue({ ...quote, status: DocumentStatus.CONVERTED }),
    },
    salesOrder: {
      create: vi.fn().mockResolvedValue({ id: "order-1", orderNumber: 7001, status: DocumentStatus.DRAFT }),
    },
  };
}

describe("convertQuoteToOrderWithTx", () => {
  it("creates an order and logs audits on success", async () => {
    const quote = buildQuote();
    const tx = buildTx(quote);
    const deps = {
      getStock: vi.fn().mockResolvedValue(new Prisma.Decimal(10)),
      nextOrderNumber: vi.fn().mockResolvedValue(7001),
      audit: vi.fn().mockResolvedValue(undefined),
    };

    const order = await convertQuoteToOrderWithTx(
      tx as unknown as Prisma.TransactionClient,
      { quoteId: "quote-1", companyId: "company-1", userId: "user-1" },
      deps,
    );

    expect(order.id).toBe("order-1");
    expect(tx.salesOrder.create).toHaveBeenCalledTimes(1);
    expect(tx.salesQuote.update).toHaveBeenCalledWith({
      where: { id: quote.id },
      data: { status: DocumentStatus.CONVERTED },
    });
    expect(deps.audit).toHaveBeenCalledTimes(2);
  });

  it("rejects when stock is insufficient", async () => {
    const quote = buildQuote();
    const tx = buildTx(quote);
    const deps = {
      getStock: vi.fn().mockResolvedValue(new Prisma.Decimal(1)),
      nextOrderNumber: vi.fn(),
      audit: vi.fn(),
    };

    await expect(
      convertQuoteToOrderWithTx(
        tx as unknown as Prisma.TransactionClient,
        { quoteId: "quote-1", companyId: "company-1", userId: "user-1" },
        deps,
      ),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<ApiError>);
  });

  it("prevents double conversion attempts", async () => {
    const quote = buildQuote({ convertedOrder: { id: "existing" } });
    const tx = buildTx(quote);
    const deps = {
      getStock: vi.fn(),
      nextOrderNumber: vi.fn(),
      audit: vi.fn(),
    };

    await expect(
      convertQuoteToOrderWithTx(
        tx as unknown as Prisma.TransactionClient,
        { quoteId: "quote-1", companyId: "company-1", userId: "user-1" },
        deps,
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining("already converted") });
  });
});
