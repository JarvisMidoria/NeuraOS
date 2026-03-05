import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NeuraLogo } from "@/components/brand/neura-logo";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  return (
    <div className="admin-shell min-h-screen bg-[#080b12] text-zinc-100">
      <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-white/10 px-4 py-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="mb-4 flex items-center justify-between lg:mb-8 lg:block">
            <NeuraLogo />
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-zinc-300">
              Admin
            </span>
          </div>
          <AdminNav />
        </aside>

        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
