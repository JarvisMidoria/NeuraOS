import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";
import { DocumentStatus, Prisma } from "@prisma/client";
import { buildReceiptPlan } from "@/lib/purchases/receipt-plan";
import { ensureOverReceiveOverridePermission } from "@/lib/purchases/permissions";
import { ApiError } from "@/lib/api-helpers";

const decimal = (value: number) => new Prisma.Decimal(value);

const baseLines = [
  {
    id: "line-1",
    productId: "product-1",
    unitPrice: decimal(10),
    orderedQuantity: decimal(10),
    receivedQuantity: decimal(0),
  },
  {
    id: "line-2",
    productId: "product-2",
    unitPrice: decimal(5),
    orderedQuantity: decimal(4),
    receivedQuantity: decimal(0),
  },
];

const createSession = (roles: string[]): Session => ({
  expires: "2099-01-01T00:00:00.000Z",
  user: {
    id: "user-1",
    companyId: "company-1",
    roles,
    permissions: [],
    name: null,
    email: null,
    image: null,
  },
});

describe("buildReceiptPlan", () => {
  it("returns RECEIVED status and stock movements when the order is fully received", () => {
    const plan = buildReceiptPlan(baseLines, [
      {
        purchaseOrderLineId: "line-1",
        productId: "product-1",
        warehouseId: "wh-1",
        quantity: 10,
      },
      {
        purchaseOrderLineId: "line-2",
        productId: "product-2",
        warehouseId: "wh-1",
        quantity: 4,
      },
    ]);

    expect(plan.resultingStatus).toBe(DocumentStatus.RECEIVED);
    expect(plan.lines).toHaveLength(2);
    expect(plan.stockMovements).toEqual([
      expect.objectContaining({ productId: "product-1", warehouseId: "wh-1", quantity: decimal(10) }),
      expect.objectContaining({ productId: "product-2", warehouseId: "wh-1", quantity: decimal(4) }),
    ]);
  });

  it("keeps the order in PARTIALLY_RECEIVED when quantities remain", () => {
    const plan = buildReceiptPlan(baseLines, [
      {
        purchaseOrderLineId: "line-1",
        productId: "product-1",
        warehouseId: "wh-1",
        quantity: 5,
      },
    ]);

    expect(plan.resultingStatus).toBe(DocumentStatus.PARTIALLY_RECEIVED);
    expect(plan.overrideUsed).toBe(false);
  });

  it("blocks over receipts unless override is allowed", () => {
    expect(() =>
      buildReceiptPlan(baseLines, [
        {
          purchaseOrderLineId: "line-1",
          productId: "product-1",
          warehouseId: "wh-1",
          quantity: 15,
        },
      ]),
    ).toThrowError(ApiError);
  });

  it("marks override usage when permitted", () => {
    const plan = buildReceiptPlan(
      baseLines,
      [
        {
          purchaseOrderLineId: "line-1",
          productId: "product-1",
          warehouseId: "wh-1",
          quantity: 10,
        },
        {
          purchaseOrderLineId: "line-2",
          productId: "product-2",
          warehouseId: "wh-1",
          quantity: 6,
        },
      ],
      { allowOverReceive: true },
    );

    expect(plan.overrideUsed).toBe(true);
    expect(plan.resultingStatus).toBe(DocumentStatus.RECEIVED);
  });

  it("accepts an explicit zero unitPrice override", () => {
    const plan = buildReceiptPlan(baseLines, [
      {
        purchaseOrderLineId: "line-1",
        productId: "product-1",
        warehouseId: "wh-1",
        quantity: 2,
        unitPrice: 0,
      },
    ]);

    expect(plan.lines[0]?.unitPrice).toEqual(decimal(0));
    expect(plan.lines[0]?.lineTotal).toEqual(decimal(0));
  });
});

describe("ensureOverReceiveOverridePermission", () => {
  it("rejects non-admin override attempts", () => {
    const session = createSession(["Sales"]);
    expect(() => ensureOverReceiveOverridePermission(session, true)).toThrowError(ApiError);
  });

  it("allows admin overrides", () => {
    const session = createSession(["Admin"]);
    expect(() => ensureOverReceiveOverridePermission(session, true)).not.toThrow();
  });
});
