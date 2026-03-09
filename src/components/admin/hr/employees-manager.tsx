"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EmployeeListItem, HrReferences } from "@/components/admin/hr/types";

interface EmployeesManagerProps {
  lang: "en" | "fr";
  initialEmployees: EmployeeListItem[];
  references: HrReferences;
  canManage: boolean;
}

export function EmployeesManager({ lang, initialEmployees, references, canManage }: EmployeesManagerProps) {
  const [employees, setEmployees] = useState<EmployeeListItem[]>(initialEmployees);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    hireDate: "",
    contractType: "PERMANENT",
    status: "ACTIVE",
    employeeCode: "",
    managerId: "",
    departmentId: "",
    positionId: "",
    locationId: "",
    entityId: "",
  });

  const t = useMemo(
    () => ({
      title: lang === "fr" ? "Employes" : "Employees",
      subtitle:
        lang === "fr"
          ? "Fiches collaborateurs, rattachement manager et structure RH."
          : "Employee records, manager mapping, and HR structure.",
      create: lang === "fr" ? "Ajouter un employe" : "Add employee",
      saving: lang === "fr" ? "Enregistrement..." : "Saving...",
      search: lang === "fr" ? "Recherche collaborateur..." : "Search employee...",
      details: lang === "fr" ? "Ouvrir la fiche" : "Open profile",
      noData: lang === "fr" ? "Aucun employe" : "No employees yet",
      noAccess:
        lang === "fr"
          ? "Acces en lecture seule. Demandez le role HR Admin pour creer des employes."
          : "Read-only access. Request HR Admin role to create employees.",
    }),
    [lang],
  );

  const filteredEmployees = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) => {
      const haystack = [
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.employeeCode ?? "",
        employee.department?.name ?? "",
        employee.position?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [employees, query]);

  const refreshEmployees = async () => {
    const response = await fetch("/api/hr/employees", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load employees");
    }
    const payload = (await response.json()) as { data?: EmployeeListItem[] };
    setEmployees(Array.isArray(payload.data) ? payload.data : []);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create employee");
      }

      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        hireDate: "",
        contractType: "PERMANENT",
        status: "ACTIVE",
        employeeCode: "",
        managerId: "",
        departmentId: "",
        positionId: "",
        locationId: "",
        entityId: "",
      });

      await refreshEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === "fr" ? "Ressources humaines" : "Human Resources"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{t.title}</h1>
        <p className="text-sm text-zinc-500">{t.subtitle}</p>
      </div>

      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            className="w-full rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900"
          />
          <button
            type="button"
            onClick={() => void refreshEmployees()}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-[var(--accent)]"
          >
            {lang === "fr" ? "Actualiser" : "Refresh"}
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-zinc-500">{t.noData}</p>
          ) : (
            filteredEmployees.map((employee) => (
              <article key={employee.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{employee.firstName} {employee.lastName}</p>
                    <p className="text-xs text-zinc-500">{employee.email}</p>
                  </div>
                  <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600">{employee.status}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{employee.department?.name ?? "—"} · {employee.position?.title ?? "—"}</p>
                <div className="mt-3">
                  <Link
                    href={`/admin/hr/employees/${employee.id}`}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:border-[var(--accent)]"
                  >
                    {t.details}
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{t.create}</h2>
        {!canManage ? <p className="mt-2 text-sm text-zinc-500">{t.noAccess}</p> : null}
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
          <input required disabled={!canManage} value={formData.firstName} onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))} placeholder={lang === "fr" ? "Prenom" : "First name"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input required disabled={!canManage} value={formData.lastName} onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))} placeholder={lang === "fr" ? "Nom" : "Last name"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input required disabled={!canManage} value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} placeholder={lang === "fr" ? "Telephone" : "Phone"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input required type="date" disabled={!canManage} value={formData.hireDate} onChange={(e) => setFormData((p) => ({ ...p, hireDate: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          <input disabled={!canManage} value={formData.employeeCode} onChange={(e) => setFormData((p) => ({ ...p, employeeCode: e.target.value }))} placeholder={lang === "fr" ? "Code employe" : "Employee code"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />

          <select disabled={!canManage} value={formData.contractType} onChange={(e) => setFormData((p) => ({ ...p, contractType: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="PERMANENT">Permanent</option>
            <option value="FIXED_TERM">Fixed term</option>
            <option value="FREELANCE">Freelance</option>
            <option value="INTERN">Intern</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="OTHER">Other</option>
          </select>
          <select disabled={!canManage} value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="ACTIVE">Active</option>
            <option value="LEFT">Left</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select disabled={!canManage} value={formData.managerId} onChange={(e) => setFormData((p) => ({ ...p, managerId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="">{lang === "fr" ? "Manager (optionnel)" : "Manager (optional)"}</option>
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

          <div className="md:col-span-2 flex justify-end">
            <button disabled={!canManage || saving} className="liquid-pill px-4 py-2 text-sm text-[var(--admin-text)] disabled:opacity-60">
              {saving ? t.saving : t.create}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
