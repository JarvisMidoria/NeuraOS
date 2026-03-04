import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";

export class ApiError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    throw new ApiError(401, "Unauthorized");
  }
  return session;
}

export function ensureRoles(session: Session, allowedRoles: string[]) {
  const roles = session.user?.roles ?? [];
  const isAllowed = allowedRoles.some((role) => roles.includes(role));
  if (!isAllowed) {
    throw new ApiError(403, "Forbidden");
  }
}

export function ensurePermissions(session: Session, requiredCodes: string[]) {
  const permissions = session.user?.permissions ?? [];
  const hasAll = requiredCodes.every((code) => permissions.includes(code));
  if (!hasAll) {
    throw new ApiError(403, "Forbidden");
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
      },
      { status: error.status },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
