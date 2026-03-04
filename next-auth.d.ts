import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      companyId: string;
      roles: string[];
      permissions: string[];
    };
  }

  interface User {
    companyId: string;
    roles: string[];
    permissions: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    companyId?: string;
    roles?: string[];
    permissions?: string[];
  }
}
