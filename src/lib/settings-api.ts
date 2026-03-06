import { Prisma } from "@prisma/client";
import { ApiError, ensurePermissions, requireSession } from "@/lib/api-helpers";

export function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value ? value.toString() : null;
}

export async function requireAdminSession() {
  const session = await requireSession();
  ensurePermissions(session, ["ADMIN"]);
  if (!session.user.companyId) {
    throw new ApiError(401, "Unauthorized");
  }
  return session;
}
