import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/saas-admin";

export async function GET() {
  try {
    await requireSuperAdminSession();

    const rows = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "TENANT_BOOTSTRAP",
            "TENANT_SUBSCRIPTION_UPDATE",
            "TENANT_SUSPEND",
            "TENANT_CANCEL",
            "TENANT_DELETE_REQUEST",
          ],
        },
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityId: row.entityId,
        companyId: row.companyId,
        companyName: row.company.name,
        createdAt: row.createdAt,
        metadata: row.metadata,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
