import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MasterShell } from "@/components/master/master-shell";

export default async function MasterLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect("/login");
  }

  if (!(user.isSuperAdmin || user.userKind === "MASTER")) {
    redirect("/admin");
  }

  return <MasterShell>{children}</MasterShell>;
}
