import type { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { UserKind } from "@prisma/client";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/super-admin";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            company: { select: { ownerUserId: true } },
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        const roleNames = user.roles.map((userRole) => userRole.role.name);
        const permissionCodes = user.roles.flatMap((userRole) =>
          userRole.role.permissions.map((rp) => rp.permission.code),
        );
        const isSuperAdmin = isSuperAdminEmail(user.email);
        const userKind = isSuperAdmin ? UserKind.MASTER : user.kind;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          roles: roleNames,
          permissions: Array.from(new Set(permissionCodes)),
          isSuperAdmin,
          userKind,
          isTenantOwner: user.company?.ownerUserId === user.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (
        user &&
        "companyId" in user &&
        "roles" in user &&
        "permissions" in user &&
        "isSuperAdmin" in user &&
        "userKind" in user &&
        "isTenantOwner" in user
      ) {
        token.companyId = user.companyId;
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.isSuperAdmin = Boolean(user.isSuperAdmin);
        token.userKind = user.userKind;
        token.isTenantOwner = Boolean(user.isTenantOwner);
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.companyId = token.companyId as string;
        session.user.roles = (token.roles as string[]) ?? [];
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        session.user.userKind = (token.userKind as UserKind | undefined) ?? UserKind.TENANT_MEMBER;
        session.user.isTenantOwner = Boolean(token.isTenantOwner);
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
