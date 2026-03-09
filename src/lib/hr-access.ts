import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export type HrScope = "ALL" | "TEAM" | "SELF";

export interface HrAccessContext {
  scope: HrScope;
  canManage: boolean;
  companyId: string;
  currentEmployeeId: string | null;
}

function hasAnyPermission(session: Session, codes: string[]) {
  const granted = new Set(session.user.permissions ?? []);
  return codes.some((code) => granted.has(code));
}

export async function resolveHrAccess(session: Session): Promise<HrAccessContext> {
  const companyId = session.user.companyId;
  if (!companyId) {
    throw new ApiError(401, "Unauthorized");
  }

  const isPlatformAdmin = hasAnyPermission(session, ["ADMIN", "HR_ADMIN"]);
  if (isPlatformAdmin) {
    return {
      scope: "ALL",
      canManage: true,
      companyId,
      currentEmployeeId: null,
    };
  }

  const isManager = hasAnyPermission(session, ["HR_MANAGER"]);
  const isEmployee = hasAnyPermission(session, ["HR_EMPLOYEE"]);

  if (!isManager && !isEmployee) {
    throw new ApiError(403, "Forbidden");
  }

  const employee = await prisma.employee.findFirst({
    where: {
      companyId,
      userId: session.user.id,
    },
    select: { id: true },
  });

  if (!employee) {
    throw new ApiError(403, "No employee profile linked to this account");
  }

  return {
    scope: isManager ? "TEAM" : "SELF",
    canManage: false,
    companyId,
    currentEmployeeId: employee.id,
  };
}

export function employeeScopeWhere(access: HrAccessContext): Prisma.EmployeeWhereInput {
  if (access.scope === "ALL") {
    return { companyId: access.companyId };
  }

  if (!access.currentEmployeeId) {
    return { companyId: access.companyId, id: "__none__" };
  }

  if (access.scope === "TEAM") {
    return {
      companyId: access.companyId,
      OR: [
        { id: access.currentEmployeeId },
        { managerId: access.currentEmployeeId },
      ],
    };
  }

  return {
    companyId: access.companyId,
    id: access.currentEmployeeId,
  };
}

export function assertCanManageHr(access: HrAccessContext) {
  if (!access.canManage) {
    throw new ApiError(403, "Forbidden");
  }
}

export async function assertEmployeeInScope(access: HrAccessContext, employeeId: string) {
  const inScope = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      ...employeeScopeWhere(access),
    },
    select: { id: true },
  });

  if (!inScope) {
    throw new ApiError(404, "Employee not found");
  }
}
