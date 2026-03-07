"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  lang: "en" | "fr";
};

type Mode = "LIVE" | "SIMULATION";

export function WorkspaceModeToggle({ lang }: Props) {
  const [mode, setMode] = useState<Mode>("LIVE");
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const text = useMemo(
    () => ({
      live: lang === "fr" ? "Reel" : "Live",
      sim: lang === "fr" ? "Simulation" : "Simulation",
      loading: lang === "fr" ? "..." : "...",
    }),
    [lang],
  );

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/workspace/mode", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: { mode?: Mode; canUseSimulation?: boolean } };
      if (!payload.data?.canUseSimulation) return;
      setAvailable(true);
      setMode(payload.data.mode === "SIMULATION" ? "SIMULATION" : "LIVE");
    };
    load();
  }, []);

  if (!available) return null;

  const setWorkspaceMode = async (nextMode: Mode) => {
    if (saving || nextMode === mode) return;
    setSaving(true);
    try {
      const response = await fetch("/api/workspace/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      if (!response.ok) return;
      setMode(nextMode);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-elevated-soft)] p-1 text-[10px]">
      <button
        type="button"
        disabled={saving}
        onClick={() => setWorkspaceMode("LIVE")}
        className={`rounded-full px-2 py-1 transition ${
          mode === "LIVE" ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]" : "text-[var(--admin-muted)]"
        }`}
      >
        {saving && mode !== "LIVE" ? text.loading : text.live}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => setWorkspaceMode("SIMULATION")}
        className={`rounded-full px-2 py-1 transition ${
          mode === "SIMULATION" ? "bg-[var(--admin-soft-bg)] text-[var(--admin-text)]" : "text-[var(--admin-muted)]"
        }`}
      >
        {saving && mode !== "SIMULATION" ? text.loading : text.sim}
      </button>
    </div>
  );
}
