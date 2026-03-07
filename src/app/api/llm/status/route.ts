import { NextResponse } from "next/server";
import { handleApiError, requireSession } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireSession();
    const configCompanyId = session.user.liveCompanyId ?? session.user.companyId;

    const config = await prisma.companyLlmConfig.findUnique({
      where: { companyId: configCompanyId },
      select: { isEnabled: true, accessMode: true },
    });

    return NextResponse.json({
      data: {
        enabled: Boolean(config?.isEnabled),
        accessMode: config?.accessMode ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
