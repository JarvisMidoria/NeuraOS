"use client";

import { useMemo, useState } from "react";

interface StructureManagerProps {
  lang: "en" | "fr";
  initialData: {
    entities: Array<{ id: string; name: string; legalName: string | null; code: string | null }>;
    departments: Array<{ id: string; name: string; code: string | null; entityId: string | null; entity: { id: string; name: string } | null; managerEmployee: { id: string; firstName: string; lastName: string } | null }>;
    positions: Array<{ id: string; title: string; level: string | null; department: { id: string; name: string } | null }>;
    locations: Array<{ id: string; name: string; city: string | null; country: string | null }>;
    managers: Array<{ id: string; firstName: string; lastName: string }>;
  };
  canManage: boolean;
}

export function StructureManager({ lang, initialData, canManage }: StructureManagerProps) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [entityForm, setEntityForm] = useState({ name: "", legalName: "", code: "" });
  const [departmentForm, setDepartmentForm] = useState({ name: "", code: "", entityId: "", managerEmployeeId: "" });
  const [positionForm, setPositionForm] = useState({ name: "", level: "", departmentId: "" });
  const [locationForm, setLocationForm] = useState({ name: "", city: "", country: "", address: "" });

  const t = useMemo(
    () => ({
      title: lang === "fr" ? "Structure entreprise" : "Company structure",
      subtitle:
        lang === "fr"
          ? "Entites, departements, postes et localisations RH."
          : "Entities, departments, positions, and HR locations.",
      refresh: lang === "fr" ? "Actualiser" : "Refresh",
      noAccess:
        lang === "fr"
          ? "Acces en lecture seule. Role HR Admin requis pour modifier la structure."
          : "Read-only access. HR Admin role required to change structure.",
      create: lang === "fr" ? "Ajouter" : "Create",
    }),
    [lang],
  );

  const refresh = async () => {
    const [structureResponse, referenceResponse] = await Promise.all([
      fetch("/api/hr/structure", { cache: "no-store" }),
      fetch("/api/hr/reference", { cache: "no-store" }),
    ]);

    if (!structureResponse.ok || !referenceResponse.ok) {
      throw new Error("Failed to reload structure");
    }

    const structurePayload = (await structureResponse.json()) as {
      data?: {
        entities?: StructureManagerProps["initialData"]["entities"];
        departments?: StructureManagerProps["initialData"]["departments"];
        positions?: StructureManagerProps["initialData"]["positions"];
        locations?: StructureManagerProps["initialData"]["locations"];
      };
    };
    const referencePayload = (await referenceResponse.json()) as { data?: { managers?: StructureManagerProps["initialData"]["managers"] } };

    setData((previous) => ({
      entities: structurePayload.data?.entities ?? previous.entities,
      departments: structurePayload.data?.departments ?? previous.departments,
      positions: structurePayload.data?.positions ?? previous.positions,
      locations: structurePayload.data?.locations ?? previous.locations,
      managers: referencePayload.data?.managers ?? previous.managers,
    }));
  };

  const createItem = async (type: "ENTITY" | "DEPARTMENT" | "POSITION" | "LOCATION", payload: Record<string, string>) => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/hr/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to create item");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
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
      {!canManage ? <div className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-700">{t.noAccess}</div> : null}

      <div className="flex justify-end">
        <button type="button" className="rounded-full border border-zinc-200 px-4 py-2 text-sm" onClick={() => void refresh()}>
          {t.refresh}
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{lang === "fr" ? "Entites" : "Entities"}</h2>
          <div className="mt-3 space-y-2 text-sm">
            {data.entities.map((entity) => (
              <p key={entity.id} className="rounded-lg border border-zinc-200 px-3 py-2">{entity.name}</p>
            ))}
          </div>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canManage) return;
              void createItem("ENTITY", entityForm).then(() => setEntityForm({ name: "", legalName: "", code: "" }));
            }}
          >
            <input disabled={!canManage} required value={entityForm.name} onChange={(e) => setEntityForm((p) => ({ ...p, name: e.target.value }))} placeholder={lang === "fr" ? "Nom entite" : "Entity name"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <input disabled={!canManage} value={entityForm.legalName} onChange={(e) => setEntityForm((p) => ({ ...p, legalName: e.target.value }))} placeholder={lang === "fr" ? "Raison sociale" : "Legal name"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <button disabled={!canManage || loading} className="liquid-pill px-3 py-2 text-sm text-[var(--admin-text)] disabled:opacity-60">{t.create}</button>
          </form>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{lang === "fr" ? "Departements" : "Departments"}</h2>
          <div className="mt-3 space-y-2 text-sm">
            {data.departments.map((department) => (
              <p key={department.id} className="rounded-lg border border-zinc-200 px-3 py-2">{department.name}</p>
            ))}
          </div>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canManage) return;
              void createItem("DEPARTMENT", departmentForm).then(() =>
                setDepartmentForm({ name: "", code: "", entityId: "", managerEmployeeId: "" }),
              );
            }}
          >
            <input disabled={!canManage} required value={departmentForm.name} onChange={(e) => setDepartmentForm((p) => ({ ...p, name: e.target.value }))} placeholder={lang === "fr" ? "Nom departement" : "Department name"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <select disabled={!canManage} value={departmentForm.entityId} onChange={(e) => setDepartmentForm((p) => ({ ...p, entityId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              <option value="">{lang === "fr" ? "Entite" : "Entity"}</option>
              {data.entities.map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name}</option>
              ))}
            </select>
            <button disabled={!canManage || loading} className="liquid-pill px-3 py-2 text-sm text-[var(--admin-text)] disabled:opacity-60">{t.create}</button>
          </form>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{lang === "fr" ? "Postes" : "Positions"}</h2>
          <div className="mt-3 space-y-2 text-sm">
            {data.positions.map((position) => (
              <p key={position.id} className="rounded-lg border border-zinc-200 px-3 py-2">{position.title}</p>
            ))}
          </div>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canManage) return;
              void createItem("POSITION", positionForm).then(() => setPositionForm({ name: "", level: "", departmentId: "" }));
            }}
          >
            <input disabled={!canManage} required value={positionForm.name} onChange={(e) => setPositionForm((p) => ({ ...p, name: e.target.value }))} placeholder={lang === "fr" ? "Intitule du poste" : "Position title"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <select disabled={!canManage} value={positionForm.departmentId} onChange={(e) => setPositionForm((p) => ({ ...p, departmentId: e.target.value }))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              <option value="">{lang === "fr" ? "Departement" : "Department"}</option>
              {data.departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
            <button disabled={!canManage || loading} className="liquid-pill px-3 py-2 text-sm text-[var(--admin-text)] disabled:opacity-60">{t.create}</button>
          </form>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{lang === "fr" ? "Localisations" : "Locations"}</h2>
          <div className="mt-3 space-y-2 text-sm">
            {data.locations.map((location) => (
              <p key={location.id} className="rounded-lg border border-zinc-200 px-3 py-2">{location.name}</p>
            ))}
          </div>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canManage) return;
              void createItem("LOCATION", locationForm).then(() =>
                setLocationForm({ name: "", city: "", country: "", address: "" }),
              );
            }}
          >
            <input disabled={!canManage} required value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} placeholder={lang === "fr" ? "Nom localisation" : "Location name"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <input disabled={!canManage} value={locationForm.city} onChange={(e) => setLocationForm((p) => ({ ...p, city: e.target.value }))} placeholder={lang === "fr" ? "Ville" : "City"} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <button disabled={!canManage || loading} className="liquid-pill px-3 py-2 text-sm text-[var(--admin-text)] disabled:opacity-60">{t.create}</button>
          </form>
        </article>
      </section>
    </div>
  );
}
