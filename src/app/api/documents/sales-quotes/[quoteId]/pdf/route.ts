import type { NextRequest } from "next/server";
import { ensurePermissions, handleApiError, requireSession, ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { buildPdfDocument } from "@/lib/documents/pdf-engine";
import { normalizeTemplateId } from "@/lib/documents/templates";
import { pdfResponse, quoteToDocumentModel } from "@/lib/documents/builders";

type RouteContext = {
  params: Promise<{ quoteId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_SALES"]);

    const { quoteId } = await context.params;
    const templateId = normalizeTemplateId(new URL(req.url).searchParams.get("template"));

    const [company, quote] = await Promise.all([
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: { name: true, domain: true, currencyCode: true },
      }),
      prisma.salesQuote.findFirst({
        where: { id: quoteId, companyId: session.user.companyId },
        include: {
          client: { select: { name: true, email: true, phone: true } },
          lines: {
            include: {
              product: { select: { sku: true, name: true } },
            },
          },
        },
      }),
    ]);

    if (!company || !quote) {
      throw new ApiError(404, "Quote not found");
    }

    const model = quoteToDocumentModel(company, quote);
    const pdfBytes = await buildPdfDocument(model, templateId);
    return pdfResponse(pdfBytes, `${model.code}.pdf`);
  } catch (error) {
    return handleApiError(error);
  }
}
