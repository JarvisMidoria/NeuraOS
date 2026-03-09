"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useRef, useState } from "react";

type HrImportDocType =
  | "ENTITIES"
  | "LOCATIONS"
  | "DEPARTMENTS"
  | "POSITIONS"
  | "EMPLOYEES"
  | "EMPLOYEE_HISTORY"
  | "EMPLOYEE_DOCUMENTS"
  | "UNKNOWN";

type PreviewResponse = {
  docType: HrImportDocType;
  rowCount: number;
  warnings: string[];
  sampleHeaders: string[];
};

type ApplyResponse = {
  docType: HrImportDocType;
  rowCount: number;
  applied: number;
  skipped: number;
  failed: number;
  warnings: string[];
  errors: string[];
};

const TYPE_LABELS: Record<HrImportDocType, { en: string; fr: string }> = {
  ENTITIES: { en: "Entities", fr: "Entites" },
  LOCATIONS: { en: "Locations", fr: "Sites" },
  DEPARTMENTS: { en: "Departments", fr: "Departements" },
  POSITIONS: { en: "Positions", fr: "Postes" },
  EMPLOYEES: { en: "Employees", fr: "Employes" },
  EMPLOYEE_HISTORY: { en: "Employee History", fr: "Historique employe" },
  EMPLOYEE_DOCUMENTS: { en: "Employee Documents", fr: "Documents employe" },
  UNKNOWN: { en: "Unknown", fr: "Inconnu" },
};

async function parseApiJson<T>(res: Response): Promise<T> {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw new Error("Invalid API response format.");
  }
  return (await res.json()) as T;
}

export function HrImportCenter({ lang }: { lang: "en" | "fr" }) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ApplyResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const text = {
    subtitle:
      lang === "fr"
        ? "Centre dedie RH: importez entites, sites, departements, postes, employes, historiques et documents RH."
        : "Dedicated HR center: import entities, locations, departments, positions, employees, history and HR documents.",
    dropHint:
      lang === "fr"
        ? "Glissez-deposez un fichier RH ici ou cliquez pour selectionner"
        : "Drag and drop an HR file here or click to browse",
    choose: lang === "fr" ? "Choisir un fichier" : "Choose file",
    clear: lang === "fr" ? "Annuler" : "Clear",
    preview: lang === "fr" ? "Previsualiser" : "Preview",
    apply: lang === "fr" ? "Appliquer import RH" : "Apply HR import",
    selected: lang === "fr" ? "Fichier selectionne" : "Selected file",
    warnings: lang === "fr" ? "Avertissements" : "Warnings",
    errors: lang === "fr" ? "Erreurs" : "Errors",
    headers: lang === "fr" ? "Colonnes detectees" : "Detected headers",
    summary: lang === "fr" ? "Resume" : "Summary",
    rows: lang === "fr" ? "Lignes" : "Rows",
    applied: lang === "fr" ? "Appliquees" : "Applied",
    skipped: lang === "fr" ? "Ignorees" : "Skipped",
    failed: lang === "fr" ? "Echecs" : "Failed",
    loading: lang === "fr" ? "Chargement..." : "Loading...",
  };

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const onSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreview(null);
    setResult(null);
    setError(null);
    event.target.value = "";
  }, []);

  const requestPreview = useCallback(async () => {
    if (!pendingFile) return;
    setLoadingPreview(true);
    setError(null);
    setPreview(null);
    setResult(null);

    try {
      const form = new FormData();
      form.set("file", pendingFile);
      const res = await fetch("/api/hr/imports/preview", { method: "POST", body: form });
      const body = await parseApiJson<{ data?: PreviewResponse; error?: string }>(res);
      if (!res.ok || !body.data) throw new Error(body.error ?? "Preview failed");
      setPreview(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  }, [pendingFile]);

  const requestApply = useCallback(async () => {
    if (!pendingFile) return;
    setLoadingApply(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("file", pendingFile);
      const res = await fetch("/api/hr/imports/apply", { method: "POST", body: form });
      const body = await parseApiJson<{ data?: ApplyResponse; error?: string }>(res);
      if (!res.ok || !body.data) throw new Error(body.error ?? "Apply failed");
      setResult(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setLoadingApply(false);
    }
  }, [pendingFile]);

  return (
    <div className="space-y-5">
      <section className="liquid-surface rounded-2xl p-4 sm:p-5">
        <p className="text-sm text-[var(--admin-muted)]">{text.subtitle}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
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
            disabled={loadingPreview || loadingApply}
          >
            {text.choose}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.tsv,.xlsx,.xls,.json,.txt"
          onChange={onSelect}
        />

        {pendingFile ? (
          <div className="mt-3 space-y-3">
            <span className="liquid-surface inline-block rounded-full px-3 py-1 text-xs text-[var(--admin-text)]">
              {text.selected}: {pendingFile.name} ({Math.max(1, Math.round(pendingFile.size / 1024))} KB)
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="liquid-pill liquid-selected px-3 py-1.5 text-xs"
                onClick={requestPreview}
                disabled={loadingPreview || loadingApply}
              >
                {loadingPreview ? text.loading : text.preview}
              </button>
              <button
                type="button"
                className="liquid-btn-primary px-3 py-1.5 text-xs"
                onClick={requestApply}
                disabled={loadingPreview || loadingApply}
              >
                {loadingApply ? text.loading : text.apply}
              </button>
              <button
                type="button"
                className="liquid-pill px-3 py-1.5 text-xs"
                onClick={() => {
                  setPendingFile(null);
                  setPreview(null);
                  setResult(null);
                  setError(null);
                }}
                disabled={loadingPreview || loadingApply}
              >
                {text.clear}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
      </section>

      {preview ? (
        <section className="liquid-surface rounded-2xl p-4">
          <p className="text-sm font-semibold text-[var(--admin-text)]">{text.summary}</p>
          <div className="mt-2 grid gap-3 text-xs text-[var(--admin-muted)] sm:grid-cols-3">
            <p>
              {text.rows}: <span className="text-[var(--admin-text)]">{preview.rowCount}</span>
            </p>
            <p>
              Type: <span className="text-[var(--admin-text)]">{TYPE_LABELS[preview.docType][lang]}</span>
            </p>
            <p>
              {text.headers}: <span className="text-[var(--admin-text)]">{preview.sampleHeaders.slice(0, 8).join(", ") || "-"}</span>
            </p>
          </div>
          {preview.warnings.length ? (
            <div className="warning-panel mt-3 rounded-xl px-3 py-2 text-xs">
              <p className="font-semibold">{text.warnings}</p>
              <ul className="mt-1 list-disc pl-4">
                {preview.warnings.map((warning, index) => (
                  <li key={`preview-warning-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section className="liquid-surface rounded-2xl p-4">
          <p className="text-sm font-semibold text-[var(--admin-text)]">{text.summary}</p>
          <div className="mt-2 grid gap-3 text-xs text-[var(--admin-muted)] sm:grid-cols-5">
            <p>{text.rows}: <span className="text-[var(--admin-text)]">{result.rowCount}</span></p>
            <p>{text.applied}: <span className="text-emerald-400">{result.applied}</span></p>
            <p>{text.skipped}: <span className="text-amber-300">{result.skipped}</span></p>
            <p>{text.failed}: <span className="text-rose-400">{result.failed}</span></p>
            <p>Type: <span className="text-[var(--admin-text)]">{TYPE_LABELS[result.docType][lang]}</span></p>
          </div>

          {result.warnings.length ? (
            <div className="warning-panel mt-3 rounded-xl px-3 py-2 text-xs">
              <p className="font-semibold">{text.warnings}</p>
              <ul className="mt-1 list-disc pl-4">
                {result.warnings.map((warning, index) => (
                  <li key={`result-warning-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.errors.length ? (
            <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
              <p className="font-semibold">{text.errors}</p>
              <ul className="mt-1 list-disc pl-4">
                {result.errors.slice(0, 10).map((entry, index) => (
                  <li key={`result-error-${index}`}>{entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
