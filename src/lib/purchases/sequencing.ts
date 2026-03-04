import type { Prisma } from "@prisma/client";

export async function getNextPurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
) {
  const last = await tx.purchaseOrder.findFirst({
    where: { companyId },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });

  return (last?.poNumber ?? 0) + 1;
}

export async function getNextReceiptNumber(tx: Prisma.TransactionClient, companyId: string) {
  const last = await tx.goodsReceipt.findFirst({
    where: { companyId },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });

  return (last?.receiptNumber ?? 0) + 1;
}
