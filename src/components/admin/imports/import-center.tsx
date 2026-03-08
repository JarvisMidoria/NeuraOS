"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type IngestionAction = {
  id: string;
  type: string;
  status: string;
  errorMessage: string | null;
  payload: unknown;
  result: unknown;
};

type IngestionJob = {
  id: string;
  source: string;
  status: string;
  docType: string;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  analysis?: { confidence?: number; warnings?: string[] } | null;
  actions: IngestionAction[];
};

type JobsResponse = {
  data: IngestionJob[];
  total: number;
  page: number;
  pageSize: number;
};

export function ImportCenter({ lang }: { lang: "en" | "fr" }) {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoApply, setAutoApply] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const text = useMemo(
    () => ({
      subtitle:
        lang === "fr"
          ? "Importez vos fichiers (CSV, XLSX, PDF, JSON, TXT), previsualisez, puis appliquez avec IA."
          : "Upload CSV, XLSX, PDF, JSON or TXT, preview parsed actions, then apply with AI.",
      chooseFile: lang === "fr" ? "Choisir un fichier" : "Choose file",
      dropHint:
        lang === "fr"
          ? "Glissez-deposez un fichier ici ou cliquez pour selectionner"
          : "Drag and drop a file here or click to browse",
      autoApply: lang === "fr" ? "Appliquer automatiquement si pret" : "Auto-apply when ready",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      apply: lang === "fr" ? "Appliquer" : "Apply",
      loading: lang === "fr" ? "Chargement..." : "Loading...",
      noData: lang === "fr" ? "Aucun import" : "No imports yet",
      actions: lang === "fr" ? "Actions" : "Actions",
      warnings: lang === "fr" ? "Avertissements" : "Warnings",
      confidence: lang === "fr" ? "Confiance" : "Confidence",
      createdAt: lang === "fr" ? "Cree" : "Created",
      file: lang === "fr" ? "Fichier" : "File",
      type: lang === "fr" ? "Type" : "Type",
      source: lang === "fr" ? "Source" : "Source",
      status: lang === "fr" ? "Statut" : "Status",
    }),
    [lang],
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ingestion/jobs?page=1&pageSize=30", { cache: "no-store" });
      const body = (await res.json()) as JobsResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load jobs");
      setJobs(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setStatus(null);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("source", "WEB_UPLOAD");
        form.set("autoApply", autoApply ? "true" : "false");

        const res = await fetch("/api/ingestion/jobs", {
          method: "POST",
          body: form,
        });
        const body = (await res.json()) as { data?: IngestionJob; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Import failed");

        setStatus(
          lang === "fr"
            ? `Import cree: ${body.data?.id ?? "-"}`
            : `Import created: ${body.data?.id ?? "-"}`,
        );
        await fetchJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setUploading(false);
      }
    },
    [autoApply, fetchJobs, lang],
  );

  const applyJob = useCallback(
    async (jobId: string) => {
      setError(null);
      setStatus(null);
      try {
        const res = await fetch(`/api/ingestion/jobs/${jobId}/apply`, { method: "POST" });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Apply failed");
        setStatus(lang === "fr" ? `Import applique: ${jobId}` : `Import applied: ${jobId}`);
        await fetchJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Apply failed");
      }
    },
    [fetchJobs, lang],
  );

  const onDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      await uploadFile(file);
    },
    [uploadFile],
  );

  const onFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  }, [uploadFile]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="space-y-5">
      <section className="liquid-surface rounded-2xl p-4 sm:p-5">
        <p className="text-sm text-[var(--admin-muted)]">{text.subtitle}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div
            className="liquid-surface rounded-xl border border-dashed border-[var(--admin-border)] p-4 text-sm text-[var(--admin-muted)]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            {text.dropHint}
          </div>
          <button
            type="button"
            className="liquid-btn-primary px-4 py-2 text-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? text.loading : text.chooseFile}
          </button>
          <button
            type="button"
            onClick={fetchJobs}
            className="liquid-pill px-4 py-2 text-sm"
            disabled={loading}
          >
            {text.refresh}
          </button>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--admin-muted)]">
          <input
            type="checkbox"
            checked={autoApply}
            onChange={(e) => setAutoApply(e.target.checked)}
          />
          {text.autoApply}
        </label>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.tsv,.xlsx,.xls,.json,.txt,.pdf,image/*"
          onChange={onFileSelect}
        />

        {status ? <p className="mt-3 text-xs text-emerald-500">{status}</p> : null}
        {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
      </section>

      <section className="space-y-3">
        {loading ? <p className="text-sm text-[var(--admin-muted)]">{text.loading}</p> : null}
        {!loading && jobs.length === 0 ? <p className="text-sm text-[var(--admin-muted)]">{text.noData}</p> : null}

        {jobs.map((job) => {
          const warnings = Array.isArray(job.analysis?.warnings) ? job.analysis?.warnings : [];
          const confidence = typeof job.analysis?.confidence === "number" ? job.analysis.confidence : null;
          const canApply = job.status === "READY_APPLY" || job.status === "ANALYZED";

          return (
            <article key={job.id} className="liquid-surface rounded-2xl p-4">
              <div className="grid gap-2 text-xs text-[var(--admin-muted)] sm:grid-cols-5">
                <div>
                  <p className="uppercase tracking-wide">{text.file}</p>
                  <p className="mt-1 text-sm text-[var(--admin-text)]">{job.fileName || "-"}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">{text.type}</p>
                  <p className="mt-1 text-sm text-[var(--admin-text)]">{job.docType}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">{text.source}</p>
                  <p className="mt-1 text-sm text-[var(--admin-text)]">{job.source}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">{text.status}</p>
                  <p className="mt-1 text-sm text-[var(--admin-text)]">{job.status}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">{text.createdAt}</p>
                  <p className="mt-1 text-sm text-[var(--admin-text)]">
                    {new Date(job.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--admin-muted)]">
                <span>{text.actions}: {job.actions.length}</span>
                {confidence !== null ? <span>{text.confidence}: {(confidence * 100).toFixed(0)}%</span> : null}
              </div>

              {warnings.length ? (
                <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                  <p className="font-semibold">{text.warnings}</p>
                  <ul className="mt-1 list-disc pl-4">
                    {warnings.slice(0, 5).map((warning, index) => (
                      <li key={`${job.id}-w-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {canApply ? (
                <div className="mt-3">
                  <button
                    type="button"
                    className="liquid-pill liquid-selected px-3 py-1.5 text-xs"
                    onClick={() => applyJob(job.id)}
                  >
                    {text.apply}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
