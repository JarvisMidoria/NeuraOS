import type { Session } from "next-auth";
import { ApiError } from "@/lib/api-helpers";

export function ensurePurchaseRole(session: Session, allowedRoles: string[]) {
  const userRoles = session.user?.roles ?? [];
  const allowed = allowedRoles.some((role) => userRoles.includes(role));
  if (!allowed) {
    throw new ApiError(403, "Forbidden");
  }
}

export function ensureOverReceiveOverridePermission(session: Session, overrideRequested: boolean) {
  if (!overrideRequested) {
    return;
  }
  const userRoles = session.user?.roles ?? [];
  if (!userRoles.includes("Admin")) {
    throw new ApiError(403, "Admin role required to override over-receipts");
  }
}
