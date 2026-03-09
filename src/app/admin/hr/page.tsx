import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveHrAccess, employeeScopeWhere } from "@/lib/hr-access";
import { getAdminLang } from "@/lib/admin-preferences";
import { HrOverview } from "@/components/admin/hr/hr-overview";

export default async function HrPage() {
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

  const [employees, departments, entities] = await Promise.all([
    prisma.employee.findMany({
      where: employeeScopeWhere(access),
      select: {
        id: true,
        status: true,
        departmentId: true,
      },
    }),
    prisma.department.findMany({
      where: { companyId: access.companyId },
      include: {
        managerEmployee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.entity.findMany({
      where: { companyId: access.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const deptCountMap = new Map<string, number>();
  for (const employee of employees) {
    if (employee.departmentId) {
      deptCountMap.set(employee.departmentId, (deptCountMap.get(employee.departmentId) ?? 0) + 1);
    }
  }

  const tree = entities.map((entity) => ({
    entityName: entity.name,
    departments: departments
      .filter((department) => department.entityId === entity.id)
      .map((department) => ({
        id: department.id,
        name: department.name,
        manager: department.managerEmployee
          ? `${department.managerEmployee.firstName} ${department.managerEmployee.lastName}`
          : null,
        members: deptCountMap.get(department.id) ?? 0,
      })),
  }));

  const orphanDepartments = departments.filter((department) => !department.entityId);
  if (orphanDepartments.length > 0) {
    tree.push({
      entityName: lang === "fr" ? "Sans entite" : "No entity",
      departments: orphanDepartments.map((department) => ({
        id: department.id,
        name: department.name,
        manager: department.managerEmployee
          ? `${department.managerEmployee.firstName} ${department.managerEmployee.lastName}`
          : null,
        members: deptCountMap.get(department.id) ?? 0,
      })),
    });
  }

  return (
    <HrOverview
      lang={lang}
      counts={{
        employees: employees.length,
        active: employees.filter((employee) => employee.status === "ACTIVE").length,
        departments: departments.length,
        entities: entities.length,
      }}
      tree={tree}
    />
  );
}
