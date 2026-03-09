import { NextResponse } from "next/server";
import { handleApiError, requireSession } from "@/lib/api-helpers";
import { assertCanManageHr, resolveHrAccess } from "@/lib/hr-access";
import { applyHrImport, ensureAllowedHrImportType } from "@/lib/hr-ingestion";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);
    assertCanManageHr(access);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await applyHrImport({
      companyId: access.companyId,
      actorUserId: session.user.id,
      fileName: file.name,
      mimeType: file.type,
      fileBuffer: Buffer.from(arrayBuffer),
    });

    ensureAllowedHrImportType(result.docType);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
