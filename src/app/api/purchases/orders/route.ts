import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { preparePurchasePayload } from "@/lib/purchases/calculations";
import { getNextPurchaseOrderNumber } from "@/lib/purchases/sequencing";
import { logAudit } from "@/lib/audit";

const orderInclude = {
  supplier: true,
  lines: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  },
  taxLines: true,
  goodsReceipts: {
    select: { id: true, receiptNumber: true, status: true, createdAt: true },
  },
} as const;

type PurchaseLineInput = {
  productId: string;
  quantity: number | string;
  unitPrice: number | string;
  taxes?: Array<{ label?: string; taxCode?: string; rate: number | string }>;
};

type PurchaseOrderPayload = {
  supplierId: string;
  expectedDate?: string | null;
  notes?: string | null;
  lines: PurchaseLineInput[];
};

function serializeDecimal(value: Prisma.Decimal | null | undefined) {
  return value ? value.toString() : "0";
}

function serializeOrder(order: Prisma.PurchaseOrderGetPayload<{ include: typeof orderInclude }>) {
  return {
    id: order.id,
    poNumber: order.poNumber,
    orderDate: order.orderDate,
    expectedDate: order.expectedDate,
    status: order.status,
    subtotalAmount: serializeDecimal(order.subtotalAmount),
    taxAmount: serializeDecimal(order.taxAmount),
    totalAmount: serializeDecimal(order.totalAmount),
    notes: order.notes,
    supplier: order.supplier,
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: line.product,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
    taxLines: order.taxLines.map((taxLine) => ({
      id: taxLine.id,
      label: taxLine.label,
      taxCode: taxLine.taxCode,
      rate: taxLine.rate.toString(),
      baseAmount: taxLine.baseAmount.toString(),
      taxAmount: taxLine.taxAmount.toString(),
    })),
    goodsReceipts: order.goodsReceipts,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "expectedDate is invalid");
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "10");
    const status = searchParams.get("status") as DocumentStatus | null;
    const supplierId = searchParams.get("supplierId");

    const where = {
      companyId: session.user.companyId,
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { orderDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      data: orders.map(serializeOrder),
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
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const body = (await req.json()) as PurchaseOrderPayload;
    if (!body.supplierId) {
      throw new ApiError(400, "supplierId is required");
    }
    if (!Array.isArray(body.lines) || !body.lines.length) {
      throw new ApiError(400, "At least one line is required");
    }

    const companyId = session.user.companyId;

    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, companyId },
    });
    if (!supplier) {
      throw new ApiError(400, "Invalid supplier");
    }

    const productIds = Array.from(new Set(body.lines.map((line) => line.productId)));
    const products = await prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new ApiError(400, "One or more products are invalid");
    }

    const prepared = preparePurchasePayload(body.lines);
    const expectedDate = parseDate(body.expectedDate);

    const order = await prisma.$transaction(async (tx) => {
      const poNumber = await getNextPurchaseOrderNumber(tx, companyId);
      return tx.purchaseOrder.create({
        data: {
          companyId,
          supplierId: body.supplierId,
          poNumber,
          expectedDate,
          status: DocumentStatus.DRAFT,
          subtotalAmount: prepared.subtotal,
          taxAmount: prepared.taxTotal,
          totalAmount: prepared.subtotal.add(prepared.taxTotal),
          notes: body.notes ?? null,
          lines: {
            create: prepared.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
          ...(prepared.taxLines.length
            ? {
                taxLines: {
                  create: prepared.taxLines.map((taxLine) => ({
                    label: taxLine.label,
                    taxCode: taxLine.taxCode,
                    rate: taxLine.rate,
                    baseAmount: taxLine.baseAmount,
                    taxAmount: taxLine.taxAmount,
                  })),
                },
              }
            : {}),
        },
        include: orderInclude,
      });
    });

    await logAudit({
      companyId,
      userId: session.user.id,
      entity: "purchaseOrder",
      entityId: order.id,
      action: "PURCHASE_ORDER_CREATE",
      metadata: { poNumber: order.poNumber },
    });

    return NextResponse.json({ data: serializeOrder(order) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
