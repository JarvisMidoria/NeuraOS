import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminLang } from "@/lib/admin-preferences";
import { employeeScopeWhere, resolveHrAccess } from "@/lib/hr-access";
import { EmployeeProfile } from "@/components/admin/hr/employee-profile";

interface PageProps {
  params: Promise<{ employeeId: string }>;
}

export default async function HrEmployeeDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  let access;
  try {
    access = await resolveHrAccess(session);
  } catch {
    redirect("/admin");
  }

  const { employeeId } = await params;
  const lang = await getAdminLang();

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      ...employeeScopeWhere(access),
    },
    include: {
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      directReports: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
      department: { select: { id: true, name: true } },
      position: { select: { id: true, title: true } },
      location: { select: { id: true, name: true, city: true, country: true } },
      entity: { select: { id: true, name: true, legalName: true } },
      histories: {
        include: {
          manager: { select: { firstName: true, lastName: true } },
          department: { select: { name: true } },
          position: { select: { title: true } },
          location: { select: { name: true } },
          entity: { select: { name: true } },
        },
        orderBy: { startDate: "desc" },
      },
      documents: {
        include: {
          uploadedByUser: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!employee) {
    redirect("/admin/hr/employees");
  }

  const [entities, departments, positions, locations, managers] = await Promise.all([
    prisma.entity.findMany({
      where: { companyId: access.companyId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { companyId: access.companyId },
      select: { id: true, name: true, code: true, entityId: true },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { companyId: access.companyId },
      select: { id: true, title: true, level: true, departmentId: true },
      orderBy: { title: "asc" },
    }),
    prisma.location.findMany({
      where: { companyId: access.companyId },
      select: { id: true, name: true, city: true, country: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { companyId: access.companyId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  return (
    <EmployeeProfile
      lang={lang}
      canManage={access.canManage}
      initialEmployee={{
        ...employee,
        dateOfBirth: employee.dateOfBirth?.toISOString() ?? null,
        hireDate: employee.hireDate.toISOString(),
        salary: employee.salary?.toString() ?? null,
        histories: employee.histories.map((history) => ({
          ...history,
          startDate: history.startDate.toISOString(),
          endDate: history.endDate?.toISOString() ?? null,
          salary: history.salary?.toString() ?? null,
        })),
        documents: employee.documents.map((document) => ({
          ...document,
          issuedAt: document.issuedAt?.toISOString() ?? null,
          expiresAt: document.expiresAt?.toISOString() ?? null,
          createdAt: document.createdAt.toISOString(),
        })),
      }}
      references={{
        entities,
        departments,
        positions,
        locations,
        managers,
      }}
    />
  );
}
