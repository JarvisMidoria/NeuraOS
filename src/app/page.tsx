import Link from "next/link";
import { NeuraLogo } from "@/components/brand/neura-logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <header className="fade-up flex items-center justify-between">
        <NeuraLogo />
        <Link
          href="/login"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-zinc-100 transition hover:border-white/35 hover:bg-white/10"
        >
          Sign in
        </Link>
      </header>

      <section className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="fade-up space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            ERP control center
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl">
            Operational clarity for teams shipping every day.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Run stock, purchasing, and sales from one fast interface. NeuraOS is structured for
            execution with clean workflows and strict operational traceability.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white transition hover:brightness-110"
            >
              Open Admin
            </Link>
            <Link
              href="https://nextjs.org/docs"
              target="_blank"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/35 hover:bg-white/5"
            >
              Platform docs
            </Link>
          </div>
        </div>

        <div className="fade-up glass-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-100">Overview</p>
            <p className="text-xs text-zinc-400">Realtime</p>
          </div>
          <div className="space-y-3">
            {[
              ["Pending purchase orders", "06"],
              ["Low stock alerts", "12"],
              ["Quotes awaiting action", "04"],
              ["Orders to fulfill", "09"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <p className="text-sm text-zinc-300">{label}</p>
                <p className="text-sm font-semibold text-zinc-100">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">System health</p>
            <p className="mt-2 text-sm text-zinc-200">
              Authentication, API, and audit logging are online.
            </p>
          </div>
        </div>
      </section>

      <footer className="fade-up pb-2 text-xs text-zinc-500">
        Built for operators who prefer speed over noise.
      </footer>
    </main>
  );
}
