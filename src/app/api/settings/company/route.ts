import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-helpers";
import { requireAdminSession } from "@/lib/settings-api";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireAdminSession();
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        id: true,
        name: true,
        domain: true,
        currencyCode: true,
        locale: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) throw new ApiError(404, "Company not found");
    return NextResponse.json({ data: company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await req.json();

    const data = {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.domain !== undefined ? { domain: body.domain ? String(body.domain).trim() : null } : {}),
      ...(body.currencyCode !== undefined ? { currencyCode: String(body.currencyCode).toUpperCase() } : {}),
      ...(body.locale !== undefined ? { locale: String(body.locale) } : {}),
      ...(body.timezone !== undefined ? { timezone: String(body.timezone) } : {}),
    };

    if ("name" in data && !data.name) throw new ApiError(400, "name is required");
    if (typeof data.currencyCode === "string" && data.currencyCode.length !== 3) {
      throw new ApiError(400, "currencyCode must be 3 chars");
    }

    const company = await prisma.company.update({
      where: { id: session.user.companyId },
      data,
      select: {
        id: true,
        name: true,
        domain: true,
        currencyCode: true,
        locale: true,
        timezone: true,
        updatedAt: true,
      },
    });

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      entity: "company",
      entityId: company.id,
      action: "COMPANY_SETTINGS_UPDATE",
      metadata: { updatedKeys: Object.keys(data) },
    });

    return NextResponse.json({ data: company });
  } catch (error) {
    return handleApiError(error);
  }
}
