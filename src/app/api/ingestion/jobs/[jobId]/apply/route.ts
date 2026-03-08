import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { applyIngestionJob, serializeIngestionJob } from "@/lib/ingestion";
import { requireAdminSession } from "@/lib/settings-api";

export async function POST(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const session = await requireAdminSession();
    const { jobId } = await context.params;

    const job = await applyIngestionJob({
      companyId: session.user.companyId,
      jobId,
      actorUserId: session.user.id,
    });

    return NextResponse.json({ data: serializeIngestionJob(job) });
  } catch (error) {
    return handleApiError(error);
  }
}
