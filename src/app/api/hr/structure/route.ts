import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ApiError, handleApiError, requireSession } from "@/lib/api-helpers";
import { assertCanManageHr, resolveHrAccess } from "@/lib/hr-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireSession();
    const access = await resolveHrAccess(session);

    const [entities, departments, positions, locations] = await Promise.all([
      prisma.entity.findMany({
        where: { companyId: access.companyId },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: { companyId: access.companyId },
        include: {
          entity: { select: { id: true, name: true } },
          managerEmployee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.position.findMany({
        where: { companyId: access.companyId },
        include: { department: { select: { id: true, name: true } } },
        orderBy: { title: "asc" },
      }),
      prisma.location.findMany({
        where: { companyId: access.companyId },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: {
        entities,
        departments,
        positions,
        locations,
      },
    });
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
    const type = String(body.type ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();

    if (!name) {
      throw new ApiError(400, "name is required");
    }

    switch (type) {
      case "ENTITY": {
        const entity = await prisma.entity.create({
          data: {
            companyId: access.companyId,
            name,
            legalName: body.legalName ? String(body.legalName).trim() : null,
            code: body.code ? String(body.code).trim() : null,
          },
        });
        return NextResponse.json({ data: entity }, { status: 201 });
      }
      case "DEPARTMENT": {
        const department = await prisma.department.create({
          data: {
            companyId: access.companyId,
            name,
            code: body.code ? String(body.code).trim() : null,
            entityId: body.entityId ? String(body.entityId) : null,
            managerEmployeeId: body.managerEmployeeId ? String(body.managerEmployeeId) : null,
          },
        });
        return NextResponse.json({ data: department }, { status: 201 });
      }
      case "POSITION": {
        const position = await prisma.position.create({
          data: {
            companyId: access.companyId,
            title: name,
            level: body.level ? String(body.level).trim() : null,
            departmentId: body.departmentId ? String(body.departmentId) : null,
          },
        });
        return NextResponse.json({ data: position }, { status: 201 });
      }
      case "LOCATION": {
        const location = await prisma.location.create({
          data: {
            companyId: access.companyId,
            name,
            address: body.address ? String(body.address).trim() : null,
            city: body.city ? String(body.city).trim() : null,
            country: body.country ? String(body.country).trim() : null,
          },
        });
        return NextResponse.json({ data: location }, { status: 201 });
      }
      default:
        throw new ApiError(400, "Invalid structure type");
    }
  } catch (error) {
    return handleApiError(error);
  }
}
