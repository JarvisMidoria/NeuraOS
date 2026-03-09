import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { EmployeeContractType, EmployeeStatus, Prisma } from "@prisma/client";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";
import { assertCanManageHr, assertEmployeeInScope, employeeScopeWhere, resolveHrAccess } from "@/lib/hr-access";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ employeeId: string }>;
}

const employeeDetailInclude = {
  manager: { select: { id: true, firstName: true, lastName: true, email: true } },
  directReports: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  location: { select: { id: true, name: true, city: true, country: true } },
  entity: { select: { id: true, name: true, legalName: true } },
  histories: {
    include: {
      manager: { select: { id: true, firstName: true, lastName: true } },
      department: { select: { id: true, name: true } },
      position: { select: { id: true, title: true } },
      location: { select: { id: true, name: true } },
      entity: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" as const },
  },
  documents: {
    include: {
      uploadedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

function normalizeStatus(value: unknown): EmployeeStatus {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "LEFT" || normalized === "SUSPENDED") {
    return normalized;
  }
  return "ACTIVE";
}

function normalizeContractType(value: unknown): EmployeeContractType {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (
    normalized === "PERMANENT" ||
    normalized === "FIXED_TERM" ||
    normalized === "FREELANCE" ||
    normalized === "INTERN" ||
    normalized === "TEMPORARY" ||
    normalized === "OTHER"
  ) {
    return normalized;
  }
  return "PERMANENT";
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);
    const { employeeId } = await context.params;

    await assertEmployeeInScope(access, employeeId);

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...employeeScopeWhere(access),
      },
      include: employeeDetailInclude,
    });

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    return NextResponse.json({ data: employee });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);
    assertCanManageHr(access);

    const { employeeId } = await context.params;
    const body = await req.json();

    const current = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: access.companyId,
      },
      select: {
        id: true,
        departmentId: true,
        positionId: true,
        locationId: true,
        entityId: true,
        managerId: true,
        status: true,
        contractType: true,
        salary: true,
      },
    });

    if (!current) {
      throw new ApiError(404, "Employee not found");
    }

    const salary = body.salary === null || body.salary === "" ? null : body.salary !== undefined ? new Prisma.Decimal(String(body.salary)) : undefined;

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(body.firstName !== undefined ? { firstName: String(body.firstName).trim() } : {}),
        ...(body.lastName !== undefined ? { lastName: String(body.lastName).trim() } : {}),
        ...(body.email !== undefined ? { email: String(body.email).trim().toLowerCase() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone).trim() : null } : {}),
        ...(body.dateOfBirth !== undefined ? { dateOfBirth: normalizeDate(body.dateOfBirth) } : {}),
        ...(body.address !== undefined ? { address: body.address ? String(body.address).trim() : null } : {}),
        ...(body.hireDate !== undefined ? { hireDate: normalizeDate(body.hireDate) ?? undefined } : {}),
        ...(body.contractType !== undefined ? { contractType: normalizeContractType(body.contractType) } : {}),
        ...(body.status !== undefined ? { status: normalizeStatus(body.status) } : {}),
        ...(salary !== undefined ? { salary } : {}),
        ...(body.managerId !== undefined ? { managerId: body.managerId ? String(body.managerId) : null } : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId ? String(body.departmentId) : null } : {}),
        ...(body.positionId !== undefined ? { positionId: body.positionId ? String(body.positionId) : null } : {}),
        ...(body.locationId !== undefined ? { locationId: body.locationId ? String(body.locationId) : null } : {}),
        ...(body.entityId !== undefined ? { entityId: body.entityId ? String(body.entityId) : null } : {}),
      },
      include: employeeDetailInclude,
    });

    const changedOrg =
      current.departmentId !== updated.departmentId ||
      current.positionId !== updated.positionId ||
      current.locationId !== updated.locationId ||
      current.entityId !== updated.entityId ||
      current.managerId !== updated.managerId ||
      current.status !== updated.status ||
      current.contractType !== updated.contractType ||
      String(current.salary ?? "") !== String(updated.salary ?? "");

    if (changedOrg) {
      await prisma.employeePositionHistory.create({
        data: {
          companyId: access.companyId,
          employeeId: updated.id,
          departmentId: updated.departmentId,
          positionId: updated.positionId,
          locationId: updated.locationId,
          entityId: updated.entityId,
          managerId: updated.managerId,
          status: updated.status,
          contractType: updated.contractType,
          salary: updated.salary,
          startDate: new Date(),
          notes: "Updated from employee profile",
        },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
