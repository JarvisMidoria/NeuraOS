import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in • ERP Admin",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            ERP Admin
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
          <p className="text-sm text-zinc-500">
            Enter the admin credentials created by the seed script.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
