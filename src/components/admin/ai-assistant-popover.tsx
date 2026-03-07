"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured?: {
    title: string;
    summary: string;
    priorities: Array<{ label: string; detail: string; href?: string }>;
    insights: Array<{ label: string; detail: string; href?: string }>;
    actions: Array<{ label: string; detail: string; href?: string }>;
  };
};

type Props = {
  lang: "en" | "fr";
};

type QuickPrompt = {
  id: string;
  label: string;
  message: string;
};

export function AiAssistantPopover({ lang }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const text = useMemo(() => {
    const quickPrompts: QuickPrompt[] =
      lang === "fr"
        ? [
            {
              id: "today",
              label: "Priorités du jour",
              message:
                "Donne-moi mes 5 priorités opérationnelles du jour en te basant sur ventes, achats, stock et commandes.",
            },
            {
              id: "stock",
              label: "Risque stock",
              message:
                "Liste les risques de rupture de stock probables cette semaine et propose un plan d'action en 3 étapes.",
            },
            {
              id: "sales",
              label: "Boost ventes",
              message:
                "Propose 3 actions concrètes pour améliorer le taux de conversion des devis cette semaine.",
            },
            {
              id: "cash",
              label: "Cash & retards",
              message:
                "Résume les risques cash liés aux commandes en attente, paiements en retard et achats en cours.",
            },
          ]
        : [
            {
              id: "today",
              label: "Today priorities",
              message:
                "Give me my top 5 operational priorities for today based on sales, purchasing, stock and orders.",
            },
            {
              id: "stock",
              label: "Stock risk",
              message:
                "List likely stockout risks for this week and provide a 3-step action plan.",
            },
            {
              id: "sales",
              label: "Boost sales",
              message:
                "Propose 3 concrete actions to improve quote conversion this week.",
            },
            {
              id: "cash",
              label: "Cash & delays",
              message:
                "Summarize cash risks from pending orders, late payments and ongoing purchases.",
            },
          ];

    return {
      title: lang === "fr" ? "Assistant IA" : "AI Assistant",
      subtitle: lang === "fr" ? "Copilote business instantané" : "Instant business copilot",
      placeholder:
        lang === "fr"
          ? "Ex: Fais-moi un plan pour sécuriser le stock sur 14 jours"
          : "Ex: Build me a 14-day stock safety plan",
      send: lang === "fr" ? "Envoyer" : "Send",
      close: lang === "fr" ? "Fermer" : "Close",
      clear: lang === "fr" ? "Effacer" : "Clear",
      priorities: lang === "fr" ? "Priorités" : "Priorities",
      insights: lang === "fr" ? "Insights" : "Insights",
      actions: lang === "fr" ? "Actions" : "Actions",
      open: lang === "fr" ? "Ouvrir" : "Open",
      empty:
        lang === "fr"
          ? "Choisis un template rapide ou pose une question personnalisée."
          : "Pick a quick template or ask your own question.",
      thinking: lang === "fr" ? "Réflexion..." : "Thinking...",
      quickPrompts,
    };
  }, [lang]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/llm/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { enabled?: boolean } };
        setEnabled(Boolean(body.data?.enabled));
      } finally {
        setLoadingStatus(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const askAssistant = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setError(null);
    setSending(true);

    const userMsg: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch("/api/llm/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const payload = (await response.json()) as {
        data?: {
          output?: string;
          structured?: {
            title: string;
            summary: string;
            priorities: Array<{ label: string; detail: string; href?: string }>;
            insights: Array<{ label: string; detail: string; href?: string }>;
            actions: Array<{ label: string; detail: string; href?: string }>;
          };
        };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }
      const assistantMsg: AssistantMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: payload.data?.output ?? "",
        structured: payload.data?.structured,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  };

  const onSend = async () => {
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    await askAssistant(message);
  };

  if (loadingStatus || !enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-text)] hover:bg-[var(--admin-soft-bg)]"
        aria-label={text.title}
        title={text.title}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="4" y="5" width="16" height="12" rx="4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="9" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="11" r="1" fill="currentColor" />
          <path d="M12 17V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {open && mounted
        ? createPortal(
        <>
          <button
            type="button"
            aria-label="Close assistant overlay"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[120] bg-[var(--admin-overlay)] backdrop-blur-[1px]"
          />
          <div className="fixed inset-0 z-[121] overflow-y-auto p-2 sm:p-4">
            <div className="flex min-h-full items-start justify-center sm:items-center">
              <div className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-elevated)] p-4 shadow-2xl sm:p-5">
                <div className="mx-auto flex h-[min(92dvh,780px)] w-full max-w-[820px] flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--admin-text)]">{text.title}</p>
              <p className="text-[11px] text-[var(--admin-muted)]">{text.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <button
                type="button"
                onClick={() => setMessages([])}
                className="rounded border border-[var(--admin-border)] px-2 py-1 text-[11px] text-[var(--admin-muted)] hover:bg-[var(--admin-soft-bg)]"
              >
                {text.clear}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-[var(--admin-border)] px-2 py-1 text-[11px] text-[var(--admin-muted)] hover:bg-[var(--admin-soft-bg)]"
              >
                {text.close}
              </button>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            {text.quickPrompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => askAssistant(prompt.message)}
                disabled={sending}
                className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-3 py-1 text-xs text-[var(--admin-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto rounded-lg border border-[var(--admin-border)] p-3">
            {messages.length === 0 ? <p className="text-xs text-[var(--admin-muted)]">{text.empty}</p> : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-8 bg-[var(--admin-soft-bg)] text-[var(--admin-text)]"
                    : "mr-8 bg-[color-mix(in_srgb,var(--accent)_20%,var(--admin-surface))] text-[var(--admin-text)]"
                }`}
              >
                {message.role === "assistant" && message.structured ? (
                  <div className="space-y-2">
                    <p className="font-semibold">{message.structured.title}</p>
                    <p className="text-sm text-[var(--admin-muted)]">{message.structured.summary}</p>

                    {message.structured.priorities.length > 0 ? (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">{text.priorities}</p>
                        <div className="space-y-1">
                          {message.structured.priorities.map((item, index) => (
                            <div key={`p-${message.id}-${index}`} className="rounded-md bg-[var(--admin-elevated-soft)] px-2 py-1">
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-[var(--admin-muted)]">{item.detail}</p>
                              {item.href ? (
                                <a className="mt-1 inline-block text-xs underline" href={item.href}>
                                  {text.open}
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {message.structured.insights.length > 0 ? (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">{text.insights}</p>
                        <div className="space-y-1">
                          {message.structured.insights.map((item, index) => (
                            <div key={`i-${message.id}-${index}`} className="rounded-md bg-[var(--admin-elevated-soft)] px-2 py-1">
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-[var(--admin-muted)]">{item.detail}</p>
                              {item.href ? (
                                <a className="mt-1 inline-block text-xs underline" href={item.href}>
                                  {text.open}
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {message.structured.actions.length > 0 ? (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">{text.actions}</p>
                        <div className="space-y-1">
                          {message.structured.actions.map((item, index) => (
                            <div key={`a-${message.id}-${index}`} className="rounded-md bg-[var(--admin-elevated-soft)] px-2 py-1">
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-[var(--admin-muted)]">{item.detail}</p>
                              {item.href ? (
                                <a className="mt-1 inline-block text-xs underline" href={item.href}>
                                  {text.open}
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  message.content
                )}
              </div>
            ))}
            {sending ? <p className="text-xs text-[var(--admin-muted)]">{text.thinking}</p> : null}
          </div>

          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

          <div className="mt-2 flex items-end gap-2">
            <textarea
              className="min-h-[92px] flex-1 resize-none rounded-lg border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-muted)]"
              placeholder={text.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={sending || !input.trim()}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text.send}
            </button>
          </div>
        </div>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )
        : null}
    </div>
  );
}
