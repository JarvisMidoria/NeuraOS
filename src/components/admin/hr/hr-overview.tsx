interface HrOverviewProps {
  lang: "en" | "fr";
  counts: {
    employees: number;
    active: number;
    departments: number;
    entities: number;
  };
  tree: Array<{
    entityName: string;
    departments: Array<{
      id: string;
      name: string;
      manager: string | null;
      members: number;
    }>;
  }>;
}

export function HrOverview({ lang, counts, tree }: HrOverviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === "fr" ? "Ressources humaines" : "Human Resources"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{lang === "fr" ? "Core HR" : "Core HR"}</h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Base collaborateurs, structure entreprise et organigramme simplifie."
            : "Employee base, company structure, and simple org chart."}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-zinc-500">{lang === "fr" ? "Employes" : "Employees"}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.employees}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-zinc-500">{lang === "fr" ? "Actifs" : "Active"}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.active}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-zinc-500">{lang === "fr" ? "Departements" : "Departments"}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.departments}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-zinc-500">{lang === "fr" ? "Entites" : "Entities"}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{counts.entities}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">{lang === "fr" ? "Organigramme simplifie" : "Simple Org Chart"}</h2>
        </div>
        <div className="space-y-4">
          {tree.length === 0 ? (
            <p className="text-sm text-zinc-500">{lang === "fr" ? "Aucune structure RH definie." : "No HR structure defined yet."}</p>
          ) : (
            tree.map((entity) => (
              <div key={entity.entityName} className="rounded-xl border border-zinc-200 bg-white p-3">
                <p className="text-sm font-semibold text-zinc-900">{entity.entityName}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {entity.departments.length === 0 ? (
                    <p className="text-xs text-zinc-500">{lang === "fr" ? "Aucun departement" : "No departments"}</p>
                  ) : (
                    entity.departments.map((department) => (
                      <div key={department.id} className="rounded-lg border border-zinc-200 p-3">
                        <p className="text-sm font-medium text-zinc-900">{department.name}</p>
                        <p className="text-xs text-zinc-500">
                          {lang === "fr" ? "Manager" : "Manager"}: {department.manager ?? (lang === "fr" ? "Non assigne" : "Unassigned")}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {lang === "fr" ? "Membres" : "Members"}: {department.members}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
