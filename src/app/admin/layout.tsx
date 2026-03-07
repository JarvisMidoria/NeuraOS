import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.companyId) {
    redirect("/login");
  }

  if (user.isSuperAdmin || user.userKind === "MASTER") {
    redirect("/master");
  }

  return <AdminShell>{children}</AdminShell>;
}
