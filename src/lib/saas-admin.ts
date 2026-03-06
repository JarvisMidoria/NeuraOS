import { ApiError, requireSession } from "@/lib/api-helpers";

export async function requireSuperAdminSession() {
  const session = await requireSession();
  if (!session.user.isSuperAdmin) {
    throw new ApiError(403, "Super admin only");
  }
  return session;
}
