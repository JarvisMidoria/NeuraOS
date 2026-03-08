import type { NextRequest } from "next/server";
import { ensurePermissions, handleApiError, requireSession, ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { buildPdfDocument } from "@/lib/documents/pdf-engine";
import { normalizeTemplateId } from "@/lib/documents/templates";
import { pdfResponse, purchaseOrderToDocumentModel } from "@/lib/documents/builders";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const { orderId } = await context.params;
    const templateId = normalizeTemplateId(new URL(req.url).searchParams.get("template"));

    const [company, order] = await Promise.all([
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: { name: true, domain: true, currencyCode: true },
      }),
      prisma.purchaseOrder.findFirst({
        where: { id: orderId, companyId: session.user.companyId },
        include: {
          supplier: { select: { name: true, email: true, phone: true, address: true } },
          lines: {
            include: {
              product: { select: { sku: true, name: true } },
            },
          },
        },
      }),
    ]);

    if (!company || !order) {
      throw new ApiError(404, "Purchase order not found");
    }

    const model = purchaseOrderToDocumentModel(company, order);
    const pdfBytes = await buildPdfDocument(model, templateId);
    return pdfResponse(pdfBytes, `${model.code}.pdf`);
  } catch (error) {
    return handleApiError(error);
  }
}
