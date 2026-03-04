import { NextResponse } from "next/server";
import { ensureRoles, handleApiError, requireSession } from "@/lib/api-helpers";
import { getLowStockProducts } from "@/lib/stock-service";

export async function GET() {
  try {
    const session = await requireSession();
    ensureRoles(session, ["Admin", "Sales"]);

    const data = await getLowStockProducts(session.user.companyId);

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
