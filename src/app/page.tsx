import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-white px-6 py-12">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          ERP Admin Starter
        </p>
        <h1 className="text-4xl font-semibold text-zinc-900">
          Operational backbone for growing teams
        </h1>
        <p className="text-lg text-zinc-600">
          PostgreSQL, Prisma, and NextAuth are wired up. Seed the database, run the
          dev server, and head to the admin area to explore sample data.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-zinc-900 px-6 py-3 text-white transition hover:bg-zinc-800"
          >
            Sign in as Admin
          </Link>
          <Link
            href="https://nextjs.org/docs"
            target="_blank"
            className="rounded-full border border-zinc-300 px-6 py-3 text-zinc-900 transition hover:border-zinc-900"
          >
            Next.js Docs
          </Link>
        </div>
      </div>
    </div>
  );
}
