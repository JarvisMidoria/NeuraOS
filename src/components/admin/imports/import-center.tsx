"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "../action-button";

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

async function parseApiJson<T>(res: Response): Promise<T> {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    const raw = await res.text().catch(() => "");
    throw new Error(raw.includes("<!DOCTYPE") ? "API returned HTML. Redeploy required or endpoint unavailable." : "Invalid API response format.");
  }
  return (await res.json()) as T;
}

export function ImportCenter({ lang }: { lang: "en" | "fr" }) {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [autoApply, setAutoApply] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const text = useMemo(
    () => ({
      subtitle:
        lang === "fr"
          ? "Importez vos fichiers (CSV, XLSX, PDF, JSON, TXT, PNG, JPG), previsualisez, puis appliquez avec IA."
          : "Upload CSV, XLSX, PDF, JSON, TXT, PNG or JPG, preview parsed actions, then apply with AI.",
      chooseFile: lang === "fr" ? "Choisir un fichier" : "Choose file",
      dropHint:
        lang === "fr"
          ? "Glissez-deposez un fichier ici ou cliquez pour selectionner"
          : "Drag and drop a file here or click to browse",
      autoApply: lang === "fr" ? "Appliquer automatiquement si pret" : "Auto-apply when ready",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      confirmImport: lang === "fr" ? "Confirmer l'import" : "Confirm import",
      clearSelection: lang === "fr" ? "Annuler selection" : "Clear selection",
      apply: lang === "fr" ? "Appliquer" : "Apply",
      loading: lang === "fr" ? "Chargement..." : "Loading...",
      noData: lang === "fr" ? "Aucun import" : "No imports yet",
      selectedFile: lang === "fr" ? "Fichier selectionne" : "Selected file",
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
      const body = await parseApiJson<JobsResponse & { error?: string }>(res);
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
        const body = await parseApiJson<{ data?: IngestionJob; error?: string }>(res);
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
        const body = await parseApiJson<{ error?: string }>(res);
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
      setPendingFile(file);
      setStatus(null);
      setError(null);
    },
    [],
  );

  const onFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setStatus(null);
    setError(null);
    event.target.value = "";
  }, []);

  const onConfirmImport = useCallback(async () => {
    if (!pendingFile) return;
    await uploadFile(pendingFile);
    setPendingFile(null);
  }, [pendingFile, uploadFile]);

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
          <ActionButton
            type="button"
            icon="upload"
            tone="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            label={uploading ? text.loading : text.chooseFile}
          />
          <ActionButton
            type="button"
            icon="refresh"
            onClick={fetchJobs}
            disabled={loading}
            label={text.refresh}
          />
        </div>

        {pendingFile ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--admin-muted)]">
            <span className="liquid-surface rounded-full px-3 py-1 text-[var(--admin-text)]">
              {text.selectedFile}: {pendingFile.name} ({Math.max(1, Math.round(pendingFile.size / 1024))} KB)
            </span>
            <ActionButton
              type="button"
              icon="apply"
              tone="primary"
              size="sm"
              onClick={onConfirmImport}
              disabled={uploading}
              label={uploading ? text.loading : text.confirmImport}
            />
            <ActionButton
              type="button"
              icon="close"
              size="sm"
              onClick={() => setPendingFile(null)}
              disabled={uploading}
              label={text.clearSelection}
            />
          </div>
        ) : null}

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
              <div className="grid gap-3 text-xs text-[var(--admin-muted)] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="min-w-0">
                  <p className="uppercase tracking-wide">{text.file}</p>
                  <p className="mt-1 break-all text-sm text-[var(--admin-text)]" title={job.fileName ?? "-"}>
                    {job.fileName || "-"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="uppercase tracking-wide">{text.type}</p>
                  <p className="mt-1 break-words text-sm text-[var(--admin-text)]">{job.docType}</p>
                </div>
                <div className="min-w-0">
                  <p className="uppercase tracking-wide">{text.source}</p>
                  <p className="mt-1 break-words text-sm text-[var(--admin-text)]">{job.source}</p>
                </div>
                <div className="min-w-0">
                  <p className="uppercase tracking-wide">{text.status}</p>
                  <p className="mt-1 break-words text-sm text-[var(--admin-text)]">{job.status}</p>
                </div>
                <div className="min-w-0">
                  <p className="uppercase tracking-wide">{text.createdAt}</p>
                  <p className="mt-1 break-words text-sm text-[var(--admin-text)]">
                    {new Date(job.createdAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--admin-muted)]">
                <span>{text.actions}: {job.actions.length}</span>
                {confidence !== null ? <span>{text.confidence}: {(confidence * 100).toFixed(0)}%</span> : null}
              </div>

              {warnings.length ? (
                <div className="warning-panel mt-3 rounded-xl px-3 py-2 text-xs">
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
                  <ActionButton
                    type="button"
                    icon="apply"
                    size="sm"
                    className="liquid-selected"
                    onClick={() => applyJob(job.id)}
                    label={text.apply}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
