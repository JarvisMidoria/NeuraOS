import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminLang } from "@/lib/admin-preferences";
import { employeeScopeWhere, resolveHrAccess } from "@/lib/hr-access";
import { EmployeesManager } from "@/components/admin/hr/employees-manager";

export default async function HrEmployeesPage() {
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

  const lang = await getAdminLang();

  const [employees, references] = await Promise.all([
    prisma.employee.findMany({
      where: employeeScopeWhere(access),
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        location: { select: { id: true, name: true } },
        entity: { select: { id: true, name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    Promise.all([
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
    ]),
  ]);

  return (
    <EmployeesManager
      lang={lang}
      initialEmployees={employees.map((employee) => ({
        ...employee,
        hireDate: employee.hireDate.toISOString(),
      }))}
      references={{
        entities: references[0],
        departments: references[1],
        positions: references[2],
        locations: references[3],
        managers: references[4],
      }}
      canManage={access.canManage}
    />
  );
}
