import type { Prisma } from "@prisma/client";

export async function getNextQuoteNumber(tx: Prisma.TransactionClient, companyId: string) {
  const lastQuote = await tx.salesQuote.findFirst({
    where: { companyId },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });

  return (lastQuote?.quoteNumber ?? 0) + 1;
}

export async function getNextOrderNumber(tx: Prisma.TransactionClient, companyId: string) {
  const lastOrder = await tx.salesOrder.findFirst({
    where: { companyId },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  return (lastOrder?.orderNumber ?? 0) + 1;
}
