import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { EmployeeContractType, EmployeeStatus, Prisma } from "@prisma/client";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";
import { assertCanManageHr, employeeScopeWhere, resolveHrAccess } from "@/lib/hr-access";
import { prisma } from "@/lib/prisma";

const employeeInclude = {
  manager: { select: { id: true, firstName: true, lastName: true } },
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  location: { select: { id: true, name: true } },
  entity: { select: { id: true, name: true } },
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

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    const where: Prisma.EmployeeWhereInput = {
      ...employeeScopeWhere(access),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const employees = await prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return NextResponse.json({ data: employees });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);
    assertCanManageHr(access);

    const body = await req.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      throw new ApiError(400, "firstName, lastName and email are required");
    }

    const hireDate = normalizeDate(body.hireDate);
    if (!hireDate) {
      throw new ApiError(400, "hireDate is required");
    }

    const salary = body.salary ? new Prisma.Decimal(String(body.salary)) : null;

    const employee = await prisma.employee.create({
      data: {
        companyId: access.companyId,
        userId: body.userId ? String(body.userId) : null,
        employeeCode: body.employeeCode ? String(body.employeeCode).trim() : null,
        firstName,
        lastName,
        email,
        phone: body.phone ? String(body.phone).trim() : null,
        dateOfBirth: normalizeDate(body.dateOfBirth),
        address: body.address ? String(body.address).trim() : null,
        hireDate,
        contractType: normalizeContractType(body.contractType),
        status: normalizeStatus(body.status),
        salary,
        managerId: body.managerId ? String(body.managerId) : null,
        departmentId: body.departmentId ? String(body.departmentId) : null,
        positionId: body.positionId ? String(body.positionId) : null,
        locationId: body.locationId ? String(body.locationId) : null,
        entityId: body.entityId ? String(body.entityId) : null,
      },
      include: employeeInclude,
    });

    await prisma.employeePositionHistory.create({
      data: {
        companyId: access.companyId,
        employeeId: employee.id,
        departmentId: employee.departmentId,
        positionId: employee.positionId,
        locationId: employee.locationId,
        entityId: employee.entityId,
        managerId: employee.managerId,
        status: employee.status,
        contractType: employee.contractType,
        salary: employee.salary,
        startDate: employee.hireDate,
        notes: "Initial assignment",
      },
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
