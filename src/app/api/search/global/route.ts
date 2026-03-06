import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

function clampQuery(raw: string) {
  return raw.trim().slice(0, 80);
}

function toInt(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);

    const url = new URL(req.url);
    const query = clampQuery(url.searchParams.get("query") ?? "");
    if (query.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const companyId = session.user.companyId;
    const maybeNumber = toInt(query);

    const [products, clients, suppliers, quotes, orders, purchases] = await Promise.all([
      prisma.product.findMany({
        where: {
          companyId,
          OR: [
            { sku: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, sku: true, name: true },
        take: 6,
      }),
      prisma.client.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true },
        take: 6,
      }),
      prisma.supplier.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true },
        take: 6,
      }),
      prisma.salesQuote.findMany({
        where: {
          companyId,
          OR: [
            ...(maybeNumber !== null ? [{ quoteNumber: maybeNumber }] : []),
            { client: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          quoteNumber: true,
          client: { select: { name: true } },
        },
        take: 6,
        orderBy: { quoteDate: "desc" },
      }),
      prisma.salesOrder.findMany({
        where: {
          companyId,
          OR: [
            ...(maybeNumber !== null ? [{ orderNumber: maybeNumber }] : []),
            { client: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          client: { select: { name: true } },
        },
        take: 6,
        orderBy: { orderDate: "desc" },
      }),
      prisma.purchaseOrder.findMany({
        where: {
          companyId,
          OR: [
            ...(maybeNumber !== null ? [{ poNumber: maybeNumber }] : []),
            { supplier: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          poNumber: true,
          supplier: { select: { name: true } },
        },
        take: 6,
        orderBy: { orderDate: "desc" },
      }),
    ]);

    const data = [
      ...products.map((item) => ({
        id: `product-${item.id}`,
        type: "product",
        title: `${item.sku} · ${item.name}`,
        subtitle: "Product",
        href: "/admin/products",
      })),
      ...clients.map((item) => ({
        id: `client-${item.id}`,
        type: "client",
        title: item.name,
        subtitle: item.email ?? "Client",
        href: "/admin/sales/quotes",
      })),
      ...suppliers.map((item) => ({
        id: `supplier-${item.id}`,
        type: "supplier",
        title: item.name,
        subtitle: item.email ?? "Supplier",
        href: "/admin/suppliers",
      })),
      ...quotes.map((item) => ({
        id: `quote-${item.id}`,
        type: "quote",
        title: `Q-${item.quoteNumber.toString().padStart(4, "0")}`,
        subtitle: item.client.name,
        href: "/admin/sales/quotes",
      })),
      ...orders.map((item) => ({
        id: `order-${item.id}`,
        type: "order",
        title: `SO-${item.orderNumber.toString().padStart(4, "0")}`,
        subtitle: item.client.name,
        href: "/admin/sales/orders",
      })),
      ...purchases.map((item) => ({
        id: `po-${item.id}`,
        type: "purchase",
        title: `PO-${item.poNumber.toString().padStart(4, "0")}`,
        subtitle: item.supplier.name,
        href: "/admin/purchases/orders",
      })),
    ].slice(0, 24);

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
