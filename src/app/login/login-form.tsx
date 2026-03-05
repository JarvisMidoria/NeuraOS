"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsSubmitting(false);
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-[var(--accent)] focus:outline-none"
          placeholder="admin@acme.local"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-[var(--accent)] focus:outline-none"
          placeholder="••••••••"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-70"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-center text-xs text-zinc-500">
        Use admin@acme.local / admin123 (seed data)
      </p>
    </form>
  );
}
