import { NextResponse } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { perfLog, perfNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { getCompanyPlanLimits } from "@/lib/subscription-limits";

export async function GET() {
  const startedAt = perfNow();
  try {
    const session = await requireSession();
    ensurePermissions(session, ["VIEW_DASHBOARD"]);

    const companyId = session.user.companyId;
    const [users, products, warehouses, suppliers, salesQuotes, purchaseOrders, taxRules, stockRule, limits] = await Promise.all([
      prisma.user.count({ where: { companyId, isActive: true } }),
      prisma.product.count({ where: { companyId } }),
      prisma.warehouse.count({ where: { companyId } }),
      prisma.supplier.count({ where: { companyId } }),
      prisma.salesQuote.count({ where: { companyId } }),
      prisma.purchaseOrder.count({ where: { companyId } }),
      prisma.taxRule.count({ where: { companyId, isActive: true } }),
      prisma.stockRule.findUnique({ where: { companyId } }),
      getCompanyPlanLimits(companyId),
    ]);

    const checklist = [
      { id: "users", label: "Create team users", done: users >= 2, value: users, target: 2 },
      { id: "products", label: "Create product catalog", done: products >= 5, value: products, target: 5 },
      { id: "warehouses", label: "Define warehouses", done: warehouses >= 1, value: warehouses, target: 1 },
      { id: "suppliers", label: "Add suppliers", done: suppliers >= 1, value: suppliers, target: 1 },
      { id: "taxes", label: "Configure taxes", done: taxRules >= 1, value: taxRules, target: 1 },
      { id: "stockRules", label: "Configure stock rules", done: Boolean(stockRule), value: stockRule ? 1 : 0, target: 1 },
      { id: "firstQuote", label: "Create first quote", done: salesQuotes >= 1, value: salesQuotes, target: 1 },
      { id: "firstPO", label: "Create first purchase order", done: purchaseOrders >= 1, value: purchaseOrders, target: 1 },
    ];

    const completed = checklist.filter((item) => item.done).length;

    return NextResponse.json(
      {
        data: {
          progress: {
            completed,
            total: checklist.length,
            percent: Math.round((completed / checklist.length) * 100),
          },
          checklist,
          subscription: {
            plan: limits.plan,
            status: limits.status,
            limits: limits.limits,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  } finally {
    perfLog("api.onboarding.status.GET", startedAt, 450);
  }
}
