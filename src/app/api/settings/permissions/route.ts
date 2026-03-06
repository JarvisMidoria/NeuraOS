import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdminSession } from "@/lib/settings-api";

export async function GET() {
  try {
    const session = await requireAdminSession();

    const permissions = await prisma.permission.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, description: true },
    });

    return NextResponse.json({ data: permissions });
  } catch (error) {
    return handleApiError(error);
  }
}
