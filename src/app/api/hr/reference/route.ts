import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { resolveHrAccess } from "@/lib/hr-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);

    const [entities, departments, positions, locations, managers] = await Promise.all([
      prisma.entity.findMany({
        where: { companyId: access.companyId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.department.findMany({
        where: { companyId: access.companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, entityId: true },
      }),
      prisma.position.findMany({
        where: { companyId: access.companyId },
        orderBy: { title: "asc" },
        select: { id: true, title: true, level: true, departmentId: true },
      }),
      prisma.location.findMany({
        where: { companyId: access.companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, city: true, country: true },
      }),
      prisma.employee.findMany({
        where: { companyId: access.companyId, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        entities,
        departments,
        positions,
        locations,
        managers,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
