import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getDashboardSnapshot } from "@/lib/dashboard-service";
import { runCompanyLlm } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

type StructuredAssistantItem = {
  label: string;
  detail: string;
  href?: string;
};

type StructuredAssistantResponse = {
  title: string;
  summary: string;
  priorities: StructuredAssistantItem[];
  insights: StructuredAssistantItem[];
  actions: StructuredAssistantItem[];
};

function safeString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function safeHref(value: unknown) {
  const href = safeString(value);
  if (!href.startsWith("/admin")) return undefined;
  return href;
}

function toStructuredItem(value: unknown): StructuredAssistantItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const label = safeString(item.label);
  const detail = safeString(item.detail);
  if (!label || !detail) return null;
  return { label, detail, href: safeHref(item.href) };
}

function parseStructuredResponse(raw: string): StructuredAssistantResponse | null {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(withoutFence) as Record<string, unknown>;
    const priorities = Array.isArray(parsed.priorities) ? parsed.priorities.map(toStructuredItem).filter(Boolean) : [];
    const insights = Array.isArray(parsed.insights) ? parsed.insights.map(toStructuredItem).filter(Boolean) : [];
    const actions = Array.isArray(parsed.actions) ? parsed.actions.map(toStructuredItem).filter(Boolean) : [];
    return {
      title: safeString(parsed.title, "Operational summary"),
      summary: safeString(parsed.summary, withoutFence.slice(0, 300)),
      priorities: priorities as StructuredAssistantItem[],
      insights: insights as StructuredAssistantItem[],
      actions: actions as StructuredAssistantItem[],
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();

    // Never allow caller-provided tenant overrides.
    if (body.companyId !== undefined || body.tenantId !== undefined || body.userId !== undefined) {
      throw new ApiError(400, "Tenant override fields are not allowed");
    }

    const message = String(body.message ?? "").trim();
    const model = body.model ? String(body.model).trim() : undefined;

    if (!message) {
      throw new ApiError(400, "message is required");
    }
    if (message.length > 4000) {
      throw new ApiError(400, "message is too long (max 4000 chars)");
    }

    const snapshot = await getDashboardSnapshot(session.user.companyId);
    const [
      company,
      clients,
      suppliers,
      warehouses,
      products,
      users,
      salesQuotes,
      salesOrders,
      purchaseOrders,
      goodsReceipts,
    ] = await Promise.all([
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: {
          id: true,
          name: true,
          domain: true,
          currencyCode: true,
          locale: true,
          timezone: true,
        },
      }),
      prisma.client.findMany({
        where: { companyId: session.user.companyId },
        select: { id: true, name: true, email: true, phone: true, address: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.supplier.findMany({
        where: { companyId: session.user.companyId },
        select: { id: true, name: true, email: true, phone: true, address: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.warehouse.findMany({
        where: { companyId: session.user.companyId },
        select: { id: true, name: true, location: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.product.findMany({
        where: { companyId: session.user.companyId },
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          unitPrice: true,
          unitOfMeasure: true,
          isActive: true,
          lowStockThreshold: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 120,
      }),
      prisma.user.findMany({
        where: { companyId: session.user.companyId },
        select: { id: true, name: true, email: true, isActive: true, kind: true, lastLoginAt: true },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.salesQuote.findMany({
        where: { companyId: session.user.companyId },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          quoteDate: true,
          validUntil: true,
          totalAmount: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: { quoteDate: "desc" },
        take: 80,
      }),
      prisma.salesOrder.findMany({
        where: { companyId: session.user.companyId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          orderDate: true,
          totalAmount: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: { orderDate: "desc" },
        take: 80,
      }),
      prisma.purchaseOrder.findMany({
        where: { companyId: session.user.companyId },
        select: {
          id: true,
          poNumber: true,
          status: true,
          orderDate: true,
          expectedDate: true,
          totalAmount: true,
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { orderDate: "desc" },
        take: 80,
      }),
      prisma.goodsReceipt.findMany({
        where: { companyId: session.user.companyId },
        select: {
          id: true,
          receiptNumber: true,
          status: true,
          receivedDate: true,
          purchaseOrder: { select: { id: true, poNumber: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { receivedDate: "desc" },
        take: 80,
      }),
    ]);

    const snapshotContext = {
      generatedAt: snapshot.timestamp,
      company,
      kpis: snapshot.kpis.map((kpi) => ({
        id: kpi.id,
        label: kpi.label,
        value: kpi.value,
        formatter: kpi.formatter,
        deltaPct: kpi.deltaPct,
        trend: kpi.trend,
      })),
      monthlySales: snapshot.monthlySales,
      latestDocuments: snapshot.latestDocuments.slice(0, 10),
      operationalTodo: snapshot.operationalTodo,
      lowStock: snapshot.lowStock.slice(0, 10),
      clients,
      suppliers,
      warehouses,
      products: products.map((p) => ({
        ...p,
        unitPrice: p.unitPrice.toString(),
        lowStockThreshold: p.lowStockThreshold?.toString() ?? null,
      })),
      users,
      salesQuotes: salesQuotes.map((q) => ({ ...q, totalAmount: q.totalAmount.toString() })),
      salesOrders: salesOrders.map((o) => ({ ...o, totalAmount: o.totalAmount.toString() })),
      purchaseOrders: purchaseOrders.map((o) => ({ ...o, totalAmount: o.totalAmount.toString() })),
      goodsReceipts,
      availableLinks: [
        ...snapshot.latestDocuments.map((d) => ({ label: `${d.type} ${d.code}`, href: d.href })),
        ...snapshot.operationalTodo.map((t) => ({ label: t.label, href: t.href })),
      ],
    };

    const result = await runCompanyLlm({
      companyId: session.user.companyId,
      message:
        `Tenant ERP context (JSON):\n${JSON.stringify(snapshotContext)}\n\n` +
        "Output STRICT JSON only with this shape (no markdown, no prose outside JSON):\n" +
        JSON.stringify({
          title: "string",
          summary: "string",
          priorities: [{ label: "string", detail: "string", href: "/admin/..." }],
          insights: [{ label: "string", detail: "string", href: "/admin/..." }],
          actions: [{ label: "string", detail: "string", href: "/admin/..." }],
        }) +
        "\nIf a link is unknown, omit href.\n\n" +
        `User question:\n${message}`,
      modelOverride: model,
      system:
        "You are an ERP copilot for operations (sales, purchasing, inventory, planning). Answer only from the provided tenant context in this request and user question. If information is missing, say what is missing. Never reference other tenants or organizations.",
    });
    const structured = parseStructuredResponse(result.content);

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "LLM_ASSISTANT_QUERY",
      entity: "llm_assistant",
      entityId: session.user.companyId,
      metadata: {
        model: result.model,
        provider: result.provider,
        accessMode: result.accessMode,
        sharedQuota: result.sharedQuota ?? undefined,
        tokenUsage: result.usage,
        structured: Boolean(structured),
        promptSize: message.length,
        contextTimestamp: snapshot.timestamp,
      },
    });

    return NextResponse.json({
      data: {
        output: result.content,
        provider: result.provider,
        model: result.model,
        accessMode: result.accessMode,
        sharedQuota: result.sharedQuota,
        usage: result.usage,
        structured:
          structured ?? {
            title: "Assistant",
            summary: result.content,
            priorities: [],
            insights: [],
            actions: [],
          },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
