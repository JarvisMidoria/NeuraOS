import Link from "next/link";
import { NeuraLogo } from "@/components/brand/neura-logo";

const benefits = [
  {
    title: "Onboarding rapide",
    description:
      "Importez vos fichiers CSV, XLSX, PDF ou images et laissez NeuraOS mapper les données vers les bons modules.",
  },
  {
    title: "Multi-tenant sécurisé",
    description:
      "Chaque société reste strictement isolée. Permissions, rôles et accès sont gérés nativement.",
  },
  {
    title: "Exécution assistée par IA",
    description:
      "Le copilote vous aide à piloter ventes, achats et stock avec une vue opérationnelle en continu.",
  },
];

const capabilities = [
  "Ventes: devis -> commandes",
  "Achats: bons + réceptions",
  "Stock: mouvements + seuils",
  "Analytics: KPI et tendances",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-8 sm:py-8">
      <header className="fade-up flex items-center justify-between">
        <NeuraLogo />
        <Link
          href="/login"
          className="liquid-btn-ghost px-4 py-2 text-sm text-zinc-100 transition hover:brightness-105"
        >
          Se connecter
        </Link>
      </header>

      <section className="grid flex-1 items-center gap-8 py-8 sm:gap-12 sm:py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="fade-up space-y-6 sm:space-y-8">
          <div className="liquid-pill inline-flex items-center gap-2 px-3 py-1 text-xs text-zinc-200">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            NeuraOS ERP SaaS
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-50 sm:text-6xl">
            Pilotez ventes, stock et achats sans friction.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            NeuraOS centralise vos opérations, vos imports et votre copilote IA dans une interface
            claire, rapide et orientée exécution.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/login"
              className="liquid-btn-primary px-6 py-3 text-center text-sm font-medium text-white transition hover:brightness-110"
            >
              Accéder à l&apos;espace
            </Link>
            <Link
              href="/login?workspace=simulation"
              className="liquid-btn-ghost px-6 py-3 text-center text-sm font-medium text-zinc-100 transition hover:brightness-105"
            >
              Voir la démo simulation
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 sm:text-sm">
            <span className="liquid-pill px-3 py-1">Multi-tenant</span>
            <span className="liquid-pill px-3 py-1">Import intelligent</span>
            <span className="liquid-pill px-3 py-1">Copilote IA</span>
            <span className="liquid-pill px-3 py-1">Audit trail</span>
          </div>
        </div>

        <div className="fade-up glass-panel rounded-3xl p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-zinc-100">Vue produit</p>
            <span className="liquid-pill px-3 py-1 text-xs text-zinc-200">Temps réel</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="liquid-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Onboarding</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Imports guidés par module</p>
            </div>
            <div className="liquid-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Copilot IA</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Web + Telegram + WhatsApp</p>
            </div>
            <div className="liquid-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Sécurité</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Isolation stricte par tenant</p>
            </div>
            <div className="liquid-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Traçabilité</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">Historique d&apos;actions complet</p>
            </div>
          </div>
          <div className="liquid-surface mt-5 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Parcours opérationnel</p>
            <div className="mt-2 space-y-2">
              {capabilities.map((label) => (
                <p key={label} className="text-sm text-zinc-200">
                  {label}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="fade-up grid gap-4 pb-8 md:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit.title} className="liquid-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-zinc-100">{benefit.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{benefit.description}</p>
          </article>
        ))}
      </section>

      <section className="fade-up glass-panel mb-5 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Ready to start</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Lancez votre espace en quelques minutes.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">
              Connectez-vous et commencez avec vos données réelles ou un mode simulation.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="liquid-btn-primary px-6 py-3 text-center text-sm font-medium text-white transition hover:brightness-110"
            >
              Se connecter
            </Link>
            <Link
              href="/login?workspace=simulation"
              className="liquid-btn-ghost px-6 py-3 text-center text-sm font-medium text-zinc-100 transition hover:brightness-105"
            >
              Mode simulation
            </Link>
          </div>
        </div>
      </section>

      <footer className="fade-up pb-2 text-center text-xs text-zinc-500 sm:text-left">
        Powered by NeuraOS
      </footer>
    </main>
  );
}
