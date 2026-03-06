import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getAdminLang } from "@/lib/admin-preferences";
import { NotificationsConsole } from "@/components/admin/notifications/notifications-console";

export default async function AdminNotificationsPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.companyId || !user.permissions?.includes("VIEW_DASHBOARD")) {
    notFound();
  }

  const lang = await getAdminLang();
  return <NotificationsConsole lang={lang} />;
}
