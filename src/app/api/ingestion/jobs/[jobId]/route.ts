import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { serializeIngestionJob } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/settings-api";

export async function GET(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const session = await requireAdminSession();
    const { jobId } = await context.params;

    const job = await prisma.ingestionJob.findFirst({
      where: {
        id: jobId,
        companyId: session.user.companyId,
      },
      include: {
        actions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Ingestion job not found" }, { status: 404 });
    }

    return NextResponse.json({ data: serializeIngestionJob(job) });
  } catch (error) {
    return handleApiError(error);
  }
}
