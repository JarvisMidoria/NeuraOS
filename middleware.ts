import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname, search } = req.nextUrl;

  if (!token || typeof token.sub !== "string" || typeof token.companyId !== "string") {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/master") || pathname.startsWith("/admin/saas")) {
    const isMaster = token.isSuperAdmin === true || token.userKind === "MASTER";
    if (!isMaster) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    const isTenantAdmin = token.userKind === "TENANT_ADMIN";
    const workspaceMode = req.cookies.get("neura_workspace_mode")?.value;
    if (isTenantAdmin && workspaceMode === "SIMULATION") {
      const allowedPrefixes = [
        "/admin",
        "/admin/analytics",
        "/admin/notifications",
        "/admin/clients",
        "/admin/sales/quotes",
        "/admin/suppliers",
      ];
      const allowed = allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      if (!allowed) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/master/:path*"],
};
