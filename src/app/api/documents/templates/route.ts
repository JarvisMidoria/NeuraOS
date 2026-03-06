import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { TEMPLATE_PALETTES } from "@/lib/documents/templates";

export async function GET() {
  try {
    await requireSession();
    const data = Object.values(TEMPLATE_PALETTES).map((template) => ({
      id: template.id,
      name: template.name,
    }));
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
