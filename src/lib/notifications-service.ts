import { DocumentStatus, NotificationSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLowStockProducts } from "@/lib/stock-service";

const OPEN_PURCHASE_STATUSES: DocumentStatus[] = [
  DocumentStatus.DRAFT,
  DocumentStatus.SENT,
  DocumentStatus.APPROVED,
  DocumentStatus.CONFIRMED,
  DocumentStatus.PARTIAL,
  DocumentStatus.PARTIALLY_RECEIVED,
];

const ACTIVE_QUOTE_STATUSES: DocumentStatus[] = [DocumentStatus.SENT, DocumentStatus.APPROVED];

function toCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

type NotificationSeed = {
  category: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  href?: string;
  fingerprint: string;
  metadata?: Prisma.InputJsonValue;
};

function makeFingerprint(parts: Array<string | number>) {
  return parts.join("|");
}

async function buildSeeds(companyId: string): Promise<NotificationSeed[]> {
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [lowStockItems, quotesExpiringSoon, approvedOrdersPending, lateReceipts] = await Promise.all([
    getLowStockProducts(companyId),
    prisma.salesQuote.count({
      where: {
        companyId,
        status: { in: ACTIVE_QUOTE_STATUSES },
        validUntil: { not: null, lte: next7Days },
      },
    }),
    prisma.salesOrder.count({
      where: {
        companyId,
        status: DocumentStatus.APPROVED,
        confirmedAt: null,
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        companyId,
        status: { in: OPEN_PURCHASE_STATUSES },
        expectedDate: { lt: now },
      },
    }),
  ]);

  const seeds: NotificationSeed[] = [];

  if (quotesExpiringSoon > 0) {
    seeds.push({
      category: "sales",
      title: "Quotes expiring soon",
      message: `${toCountLabel(quotesExpiringSoon, "quote", "quotes")} will expire within 7 days.`,
      severity: quotesExpiringSoon > 5 ? NotificationSeverity.HIGH : NotificationSeverity.MEDIUM,
      href: "/admin/sales/quotes",
      fingerprint: makeFingerprint(["sales", "quotes-expiring", quotesExpiringSoon]),
      metadata: { count: quotesExpiringSoon },
    });
  }

  if (approvedOrdersPending > 0) {
    seeds.push({
      category: "sales",
      title: "Orders pending confirmation",
      message: `${toCountLabel(approvedOrdersPending, "order", "orders")} approved but not confirmed.`,
      severity: approvedOrdersPending > 3 ? NotificationSeverity.HIGH : NotificationSeverity.MEDIUM,
      href: "/admin/sales/orders",
      fingerprint: makeFingerprint(["sales", "orders-awaiting-confirmation", approvedOrdersPending]),
      metadata: { count: approvedOrdersPending },
    });
  }

  if (lateReceipts > 0) {
    seeds.push({
      category: "operations",
      title: "Late purchase receipts",
      message: `${toCountLabel(lateReceipts, "receipt", "receipts")} are overdue from suppliers.`,
      severity: NotificationSeverity.HIGH,
      href: "/admin/purchases/receipts",
      fingerprint: makeFingerprint(["ops", "late-receipts", lateReceipts]),
      metadata: { count: lateReceipts },
    });
  }

  lowStockItems.slice(0, 6).forEach((item) => {
    const current = Number(item.currentStock ?? 0);
    const threshold = Number(item.lowStockThreshold ?? 0);
    const deficit = Math.max(threshold - current, 0);
    seeds.push({
      category: "stock",
      title: `${item.sku} low stock`,
      message: `${item.name}: ${current} on hand, threshold ${threshold}. Suggested +${Math.ceil(deficit)}.`,
      severity: current <= 0 ? NotificationSeverity.HIGH : NotificationSeverity.MEDIUM,
      href: "/admin/stock",
      fingerprint: makeFingerprint(["stock", item.id, current, threshold]),
      metadata: {
        productId: item.id,
        sku: item.sku,
        currentStock: current,
        threshold,
      },
    });
  });

  return seeds;
}

export async function syncCompanyNotifications(companyId: string) {
  const seeds = await buildSeeds(companyId);

  if (seeds.length === 0) {
    return { generated: 0, unread: 0 };
  }

  await prisma.$transaction(
    seeds.map((seed) =>
      prisma.notification.upsert({
        where: {
          companyId_fingerprint: {
            companyId,
            fingerprint: seed.fingerprint,
          },
        },
        create: {
          companyId,
          category: seed.category,
          title: seed.title,
          message: seed.message,
          severity: seed.severity,
          href: seed.href,
          fingerprint: seed.fingerprint,
          ...(seed.metadata !== undefined ? { metadata: seed.metadata } : {}),
        },
        update: {
          title: seed.title,
          message: seed.message,
          severity: seed.severity,
          href: seed.href,
          ...(seed.metadata !== undefined ? { metadata: seed.metadata } : {}),
          readAt: null,
        },
      }),
    ),
  );

  const unread = await prisma.notification.count({
    where: { companyId, readAt: null },
  });

  return { generated: seeds.length, unread };
}

export async function listCompanyNotifications(companyId: string, limit = 20) {
  const take = Math.max(1, Math.min(100, limit));
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.notification.count({ where: { companyId, readAt: null } }),
  ]);

  return {
    unread,
    data: notifications,
  };
}

export async function markNotificationRead(companyId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      companyId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function markAllNotificationsRead(companyId: string) {
  return prisma.notification.updateMany({
    where: {
      companyId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}
