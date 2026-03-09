import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminLang } from "@/lib/admin-preferences";
import { resolveHrAccess } from "@/lib/hr-access";
import { StructureManager } from "@/components/admin/hr/structure-manager";

export default async function HrStructurePage() {
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

  const [entities, departments, positions, locations, managers] = await Promise.all([
    prisma.entity.findMany({
      where: { companyId: access.companyId },
      select: { id: true, name: true, legalName: true, code: true },
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
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: { title: "asc" },
    }),
    prisma.location.findMany({
      where: { companyId: access.companyId },
      select: { id: true, name: true, city: true, country: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { companyId: access.companyId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  return (
    <StructureManager
      lang={lang}
      canManage={access.canManage}
      initialData={{
        entities,
        departments,
        positions,
        locations,
        managers,
      }}
    />
  );
}
