"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  lang: "en" | "fr";
};

export function AiAssistantPopover({ lang }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const text = useMemo(
    () => ({
      title: lang === "fr" ? "Assistant IA" : "AI Assistant",
      subtitle: lang === "fr" ? "Pose une question opérationnelle" : "Ask an operational question",
      placeholder:
        lang === "fr"
          ? "Ex: Résume mes priorités achats de la semaine"
          : "Ex: Summarize my purchasing priorities this week",
      send: lang === "fr" ? "Envoyer" : "Send",
      close: lang === "fr" ? "Fermer" : "Close",
      empty:
        lang === "fr"
          ? "Commence une conversation pour obtenir des recommandations." 
          : "Start a conversation to get recommendations.",
      thinking: lang === "fr" ? "Réflexion..." : "Thinking...",
    }),
    [lang],
  );

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

  const onSend = async () => {
    const message = input.trim();
    if (!message || sending) return;

    setError(null);
    setSending(true);
    setInput("");

    const userMsg: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch("/api/llm/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as { data?: { output?: string }; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }
      const assistantMsg: AssistantMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: payload.data?.output ?? "",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  };

  if (loadingStatus || !enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg border border-white/15 p-2 text-zinc-200 hover:bg-white/10"
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

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,420px)] rounded-xl border border-white/10 bg-[#0a0f1d] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-zinc-100">{text.title}</p>
              <p className="text-[11px] text-zinc-400">{text.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-white/15 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
            >
              {text.close}
            </button>
          </div>

          <div ref={scrollRef} className="max-h-72 space-y-2 overflow-auto rounded-lg border border-white/10 p-2">
            {messages.length === 0 ? <p className="text-xs text-zinc-500">{text.empty}</p> : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === "user" ? "ml-8 bg-white/10 text-zinc-100" : "mr-8 bg-indigo-500/15 text-indigo-100"
                }`}
              >
                {message.content}
              </div>
            ))}
            {sending ? <p className="text-xs text-zinc-400">{text.thinking}</p> : null}
          </div>

          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

          <div className="mt-2 flex items-end gap-2">
            <textarea
              className="min-h-[74px] flex-1 resize-none rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              placeholder={text.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={sending || !input.trim()}
              className="rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text.send}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
