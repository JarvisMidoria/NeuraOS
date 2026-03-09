export type HrReferenceEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type HrReferences = {
  entities: Array<{ id: string; name: string; code: string | null }>;
  departments: Array<{ id: string; name: string; code: string | null; entityId: string | null }>;
  positions: Array<{ id: string; title: string; level: string | null; departmentId: string | null }>;
  locations: Array<{ id: string; name: string; city: string | null; country: string | null }>;
  managers: HrReferenceEmployee[];
};

export type EmployeeListItem = {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "LEFT" | "SUSPENDED";
  contractType: "PERMANENT" | "FIXED_TERM" | "FREELANCE" | "INTERN" | "TEMPORARY" | "OTHER";
  hireDate: string;
  manager: { id: string; firstName: string; lastName: string } | null;
  department: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  location: { id: string; name: string } | null;
  entity: { id: string; name: string } | null;
};
