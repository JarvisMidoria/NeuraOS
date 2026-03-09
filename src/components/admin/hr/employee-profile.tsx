"use client";

import { useMemo, useState } from "react";
import type { HrReferences } from "@/components/admin/hr/types";

type EmployeeProfilePayload = {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  hireDate: string;
  contractType: "PERMANENT" | "FIXED_TERM" | "FREELANCE" | "INTERN" | "TEMPORARY" | "OTHER";
  status: "ACTIVE" | "LEFT" | "SUSPENDED";
  salary: string | null;
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string; email: string } | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  positionId: string | null;
  position: { id: string; title: string } | null;
  locationId: string | null;
  location: { id: string; name: string; city: string | null; country: string | null } | null;
  entityId: string | null;
  entity: { id: string; name: string; legalName: string | null } | null;
  directReports: Array<{ id: string; firstName: string; lastName: string; email: string; status: string }>;
  histories: Array<{
    id: string;
    startDate: string;
    endDate: string | null;
    status: string;
    contractType: string;
    salary: string | null;
    notes: string | null;
    manager: { firstName: string; lastName: string } | null;
    department: { name: string } | null;
    position: { title: string } | null;
    location: { name: string } | null;
    entity: { name: string } | null;
  }>;
  documents: Array<{
    id: string;
    type: string;
    fileName: string;
    fileUrl: string | null;
    notes: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    uploadedByUser: { name: string; email: string } | null;
  }>;
};

interface EmployeeProfileProps {
  lang: "en" | "fr";
  initialEmployee: EmployeeProfilePayload;
  references: HrReferences;
  canManage: boolean;
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function EmployeeProfile({ lang, initialEmployee, references, canManage }: EmployeeProfileProps) {
  const [employee, setEmployee] = useState(initialEmployee);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [docSaving, setDocSaving] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    type: "CONTRACT",
    fileName: "",
    fileUrl: "",
    notes: "",
    issuedAt: "",
    expiresAt: "",
  });

  const [formData, setFormData] = useState({
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? "",
    dateOfBirth: toDateInput(employee.dateOfBirth),
    address: employee.address ?? "",
    hireDate: toDateInput(employee.hireDate),
    contractType: employee.contractType,
    status: employee.status,
    salary: employee.salary ?? "",
    managerId: employee.managerId ?? "",
    departmentId: employee.departmentId ?? "",
    positionId: employee.positionId ?? "",
    locationId: employee.locationId ?? "",
    entityId: employee.entityId ?? "",
  });

  const t = useMemo(
    () => ({
      title: lang === "fr" ? "Fiche salarie" : "Employee profile",
      personal: lang === "fr" ? "Informations personnelles" : "Personal information",
      professional: lang === "fr" ? "Informations professionnelles" : "Professional information",
      manager: lang === "fr" ? "Manager" : "Manager",
      status: lang === "fr" ? "Statut" : "Status",
      history: lang === "fr" ? "Historique du poste" : "Position history",
      documents: lang === "fr" ? "Documents RH" : "HR documents",
      save: lang === "fr" ? "Sauvegarder" : "Save",
      saving: lang === "fr" ? "Sauvegarde..." : "Saving...",
      addDocument: lang === "fr" ? "Ajouter document" : "Add document",
      noDocs: lang === "fr" ? "Aucun document RH" : "No HR documents",
      readOnly:
        lang === "fr"
          ? "Acces en lecture seule pour ce profil."
          : "Read-only access for this profile.",
    }),
    [lang],
  );

  const reload = async () => {
    const response = await fetch(`/api/hr/employees/${employee.id}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to reload employee profile");
    }
    const payload = (await response.json()) as { data?: EmployeeProfilePayload };
    if (payload.data) {
      setEmployee(payload.data);
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;

    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/hr/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save profile");
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const addDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;

    setError(null);
    setDocSaving(true);
    try {
      const response = await fetch(`/api/hr/employees/${employee.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to add document");
      }

      setDocumentForm({
        type: "CONTRACT",
        fileName: "",
        fileUrl: "",
        notes: "",
        issuedAt: "",
        expiresAt: "",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setDocSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === "fr" ? "Ressources humaines" : "Human Resources"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{employee.firstName} {employee.lastName}</h1>
        <p className="text-sm text-zinc-500">{t.title}</p>
      </div>

      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}
      {!canManage ? <div className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">{t.readOnly}</div> : null}

      <form onSubmit={saveProfile} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{t.personal}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input disabled={!canManage} value={formData.firstName} onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} value={formData.lastName} onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} type="date" value={formData.dateOfBirth} onChange={(e) => setFormData((p) => ({ ...p, dateOfBirth: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} type="date" value={formData.hireDate} onChange={(e) => setFormData((p) => ({ ...p, hireDate: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <textarea disabled={!canManage} value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} className="md:col-span-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm" rows={2} />
        </div>

        <h2 className="mt-5 text-lg font-semibold text-zinc-900">{t.professional}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select disabled={!canManage} value={formData.contractType} onChange={(e) => setFormData((p) => ({ ...p, contractType: e.target.value as EmployeeProfilePayload["contractType"] }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="PERMANENT">Permanent</option>
            <option value="FIXED_TERM">Fixed term</option>
            <option value="FREELANCE">Freelance</option>
            <option value="INTERN">Intern</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="OTHER">Other</option>
          </select>
          <select disabled={!canManage} value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as EmployeeProfilePayload["status"] }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="ACTIVE">Active</option>
            <option value="LEFT">Left</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <input disabled={!canManage} value={formData.salary} onChange={(e) => setFormData((p) => ({ ...p, salary: e.target.value }))} placeholder={lang === "fr" ? "Salaire" : "Salary"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />

          <select disabled={!canManage} value={formData.managerId} onChange={(e) => setFormData((p) => ({ ...p, managerId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="">{lang === "fr" ? "Manager" : "Manager"}</option>
            {references.managers.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName}</option>
            ))}
          </select>
          <select disabled={!canManage} value={formData.departmentId} onChange={(e) => setFormData((p) => ({ ...p, departmentId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="">{lang === "fr" ? "Departement" : "Department"}</option>
            {references.departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
          <select disabled={!canManage} value={formData.positionId} onChange={(e) => setFormData((p) => ({ ...p, positionId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="">{lang === "fr" ? "Poste" : "Position"}</option>
            {references.positions.map((position) => (
              <option key={position.id} value={position.id}>{position.title}</option>
            ))}
          </select>
          <select disabled={!canManage} value={formData.locationId} onChange={(e) => setFormData((p) => ({ ...p, locationId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="">{lang === "fr" ? "Localisation" : "Location"}</option>
            {references.locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
          <select disabled={!canManage} value={formData.entityId} onChange={(e) => setFormData((p) => ({ ...p, entityId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="">{lang === "fr" ? "Entite" : "Entity"}</option>
            {references.entities.map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex justify-end">
          <button disabled={!canManage || saving} className="liquid-pill px-4 py-2 text-sm text-[var(--admin-text)] disabled:opacity-60">
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{t.manager}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName} (${employee.manager.email})` : "—"}
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{t.status}</h2>
        <p className="mt-2 text-sm text-zinc-600">{employee.status} · {employee.contractType}</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{t.history}</h2>
        <div className="mt-3 space-y-2">
          {employee.histories.length === 0 ? (
            <p className="text-sm text-zinc-500">—</p>
          ) : (
            employee.histories.map((history) => (
              <article key={history.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                <p className="font-medium text-zinc-900">{history.position?.title ?? "—"} · {history.department?.name ?? "—"}</p>
                <p className="text-zinc-500">{new Date(history.startDate).toLocaleDateString()} {history.endDate ? `→ ${new Date(history.endDate).toLocaleDateString()}` : ""}</p>
                <p className="text-zinc-500">{history.status} · {history.contractType}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{t.documents}</h2>
        <div className="mt-3 space-y-2">
          {employee.documents.length === 0 ? (
            <p className="text-sm text-zinc-500">{t.noDocs}</p>
          ) : (
            employee.documents.map((document) => (
              <article key={document.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                <p className="font-medium text-zinc-900">{document.fileName}</p>
                <p className="text-zinc-500">{document.type} · {new Date(document.createdAt).toLocaleDateString()}</p>
                {document.fileUrl ? (
                  <a href={document.fileUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">
                    {lang === "fr" ? "Ouvrir" : "Open"}
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>

        <form className="mt-4 grid gap-2 md:grid-cols-2" onSubmit={addDocument}>
          <select disabled={!canManage} value={documentForm.type} onChange={(e) => setDocumentForm((p) => ({ ...p, type: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="CONTRACT">Contract</option>
            <option value="IDENTITY">Identity</option>
            <option value="PAYSLIP">Payslip</option>
            <option value="CERTIFICATE">Certificate</option>
            <option value="INTERNAL">Internal</option>
            <option value="OTHER">Other</option>
          </select>
          <input disabled={!canManage} required value={documentForm.fileName} onChange={(e) => setDocumentForm((p) => ({ ...p, fileName: e.target.value }))} placeholder={lang === "fr" ? "Nom du document" : "Document name"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} value={documentForm.fileUrl} onChange={(e) => setDocumentForm((p) => ({ ...p, fileUrl: e.target.value }))} placeholder="https://..." className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} value={documentForm.notes} onChange={(e) => setDocumentForm((p) => ({ ...p, notes: e.target.value }))} placeholder={lang === "fr" ? "Notes" : "Notes"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} type="date" value={documentForm.issuedAt} onChange={(e) => setDocumentForm((p) => ({ ...p, issuedAt: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} type="date" value={documentForm.expiresAt} onChange={(e) => setDocumentForm((p) => ({ ...p, expiresAt: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <div className="md:col-span-2 flex justify-end">
            <button disabled={!canManage || docSaving} className="liquid-pill px-4 py-2 text-sm text-[var(--admin-text)] disabled:opacity-60">
              {docSaving ? t.saving : t.addDocument}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
