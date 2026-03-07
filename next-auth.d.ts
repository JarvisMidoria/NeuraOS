import type { DefaultSession } from "next-auth";
import "next-auth/jwt";
import type { UserKind } from "@prisma/client";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      companyId: string;
      liveCompanyId?: string;
      workspaceMode?: "LIVE" | "SIMULATION";
      roles: string[];
      permissions: string[];
      isSuperAdmin: boolean;
      userKind: UserKind;
      isTenantOwner: boolean;
    };
  }

  interface User {
    companyId: string;
    liveCompanyId?: string;
    workspaceMode?: "LIVE" | "SIMULATION";
    roles: string[];
    permissions: string[];
    isSuperAdmin: boolean;
    userKind: UserKind;
    isTenantOwner: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    companyId?: string;
    roles?: string[];
    permissions?: string[];
    isSuperAdmin?: boolean;
    userKind?: UserKind;
    isTenantOwner?: boolean;
  }
}
