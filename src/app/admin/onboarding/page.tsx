import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminLang } from "@/lib/admin-preferences";
import { OnboardingConsole } from "@/components/admin/onboarding/onboarding-console";

export default async function AdminOnboardingPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.companyId) {
    redirect("/login");
  }

  const lang = await getAdminLang();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--admin-muted)]">Launch</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)]">Onboarding</h1>
        <p className="text-sm text-[var(--admin-muted)]">Tenant activation checklist and subscription guardrails.</p>
      </div>
      <OnboardingConsole lang={lang} />
    </div>
  );
}
