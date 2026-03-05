import type { Metadata } from "next";
import { Suspense } from "react";
import { NeuraLogo } from "@/components/brand/neura-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in • ERP Admin",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8">
      <div className="fade-up mb-8">
        <NeuraLogo />
      </div>
      <div className="grid w-full flex-1 gap-8 lg:grid-cols-[1fr_460px]">
        <section className="fade-up hidden flex-col justify-center space-y-6 lg:flex">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">NeuraOS Admin</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight text-zinc-50">
            Fast control plane for purchase, stock, and sales operations.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-zinc-400">
            Connect your team on one secure interface. Every move is logged, permissions are
            role-driven, and every metric stays visible in real time.
          </p>
          <div className="flex gap-2 text-xs text-zinc-500">
            <span className="rounded-full border border-white/15 px-3 py-1">Role-based access</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Audit trail</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Realtime inventory</span>
          </div>
        </section>

        <div className="fade-up glass-panel rounded-3xl p-7 sm:p-9">
          <div className="mb-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">ERP Admin</p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">Sign in</h2>
            <p className="text-sm text-zinc-400">Use your admin credentials to access the console.</p>
          </div>
          <Suspense fallback={<p className="text-sm text-zinc-400">Loading form...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
