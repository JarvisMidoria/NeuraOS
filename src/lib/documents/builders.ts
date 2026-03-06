import type { DocumentModel } from "@/lib/documents/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDecimal(value: { toString(): string } | null | undefined) {
  if (!value) return "0";
  return Number(value.toString()).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function quoteToDocumentModel(
  company: { name: string; domain?: string | null },
  quote: {
    quoteNumber: number;
    quoteDate: Date;
    validUntil?: Date | null;
    notes?: string | null;
    subtotalAmount: { toString(): string };
    taxAmount: { toString(): string };
    totalAmount: { toString(): string };
    client: { name: string; email?: string | null; phone?: string | null };
    lines: Array<{
      quantity: { toString(): string };
      unitPrice: { toString(): string };
      lineTotal: { toString(): string };
      product: { sku: string; name: string };
      description?: string | null;
    }>;
  },
): DocumentModel {
  return {
    title: "Sales Quote",
    code: `Q-${quote.quoteNumber.toString().padStart(4, "0")}`,
    issueDate: quote.quoteDate.toLocaleDateString("en-CA"),
    dueDate: quote.validUntil ? quote.validUntil.toLocaleDateString("en-CA") : null,
    companyName: company.name,
    companyMeta: company.domain ?? undefined,
    counterpartLabel: "Bill To",
    counterpartName: quote.client.name,
    counterpartMeta: [quote.client.email, quote.client.phone].filter(Boolean).join(" · ") || undefined,
    notes: quote.notes,
    rows: quote.lines.map((line) => ({
      label: `${line.product.sku} · ${line.product.name}`,
      meta: line.description ?? undefined,
      quantity: formatDecimal(line.quantity),
      unitPrice: formatCurrency(Number(line.unitPrice.toString())),
      total: formatCurrency(Number(line.lineTotal.toString())),
    })),
    totals: [
      { label: "Subtotal", value: formatCurrency(Number(quote.subtotalAmount.toString())) },
      { label: "Tax", value: formatCurrency(Number(quote.taxAmount.toString())) },
      { label: "Total", value: formatCurrency(Number(quote.totalAmount.toString())) },
    ],
  };
}

export function salesOrderToDeliveryModel(
  company: { name: string; domain?: string | null },
  order: {
    orderNumber: number;
    orderDate: Date;
    notes?: string | null;
    client: { name: string; email?: string | null; phone?: string | null; address?: string | null };
    lines: Array<{
      quantity: { toString(): string };
      product: { sku: string; name: string };
      warehouse: { name: string };
      description?: string | null;
    }>;
  },
): DocumentModel {
  return {
    title: "Delivery Note",
    code: `SO-${order.orderNumber.toString().padStart(4, "0")}`,
    issueDate: order.orderDate.toLocaleDateString("en-CA"),
    companyName: company.name,
    companyMeta: company.domain ?? undefined,
    counterpartLabel: "Deliver To",
    counterpartName: order.client.name,
    counterpartMeta: [order.client.address, order.client.email, order.client.phone].filter(Boolean).join(" · ") || undefined,
    notes: order.notes,
    rows: order.lines.map((line) => ({
      label: `${line.product.sku} · ${line.product.name}`,
      meta: [line.description, line.warehouse.name].filter(Boolean).join(" · "),
      quantity: formatDecimal(line.quantity),
      unitPrice: "-",
      total: "-",
    })),
  };
}

export function purchaseOrderToDocumentModel(
  company: { name: string; domain?: string | null },
  order: {
    poNumber: number;
    orderDate: Date;
    expectedDate?: Date | null;
    notes?: string | null;
    subtotalAmount: { toString(): string };
    taxAmount: { toString(): string };
    totalAmount: { toString(): string };
    supplier: { name: string; email?: string | null; phone?: string | null; address?: string | null };
    lines: Array<{
      quantity: { toString(): string };
      unitPrice: { toString(): string };
      lineTotal: { toString(): string };
      product: { sku: string; name: string };
    }>;
  },
): DocumentModel {
  return {
    title: "Purchase Order",
    code: `PO-${order.poNumber.toString().padStart(4, "0")}`,
    issueDate: order.orderDate.toLocaleDateString("en-CA"),
    dueDate: order.expectedDate ? order.expectedDate.toLocaleDateString("en-CA") : null,
    companyName: company.name,
    companyMeta: company.domain ?? undefined,
    counterpartLabel: "Supplier",
    counterpartName: order.supplier.name,
    counterpartMeta: [order.supplier.address, order.supplier.email, order.supplier.phone].filter(Boolean).join(" · ") || undefined,
    notes: order.notes,
    rows: order.lines.map((line) => ({
      label: `${line.product.sku} · ${line.product.name}`,
      quantity: formatDecimal(line.quantity),
      unitPrice: formatCurrency(Number(line.unitPrice.toString())),
      total: formatCurrency(Number(line.lineTotal.toString())),
    })),
    totals: [
      { label: "Subtotal", value: formatCurrency(Number(order.subtotalAmount.toString())) },
      { label: "Tax", value: formatCurrency(Number(order.taxAmount.toString())) },
      { label: "Total", value: formatCurrency(Number(order.totalAmount.toString())) },
    ],
  };
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  const normalized = Uint8Array.from(bytes);
  const body = new Blob([normalized], { type: "application/pdf" });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"${filename}\"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
