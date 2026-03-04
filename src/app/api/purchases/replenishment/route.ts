import { NextResponse } from "next/server";
import { ensurePermissions, handleApiError, requireSession } from "@/lib/api-helpers";
import { getLowStockProducts } from "@/lib/stock-service";

export async function GET() {
  try {
    const session = await requireSession();
    ensurePermissions(session, ["MANAGE_PURCHASING"]);

    const suggestions = await getLowStockProducts(session.user.companyId);
    return NextResponse.json({ data: suggestions });
  } catch (error) {
    return handleApiError(error);
  }
}
