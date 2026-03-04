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
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-900 focus:outline-none"
          placeholder="admin@acme.local"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-900 focus:outline-none"
          placeholder="••••••••"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-white transition hover:bg-zinc-800 disabled:opacity-70"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-center text-xs text-zinc-500">
        Use admin@acme.local / admin123 (seed data)
      </p>
    </form>
  );
}
