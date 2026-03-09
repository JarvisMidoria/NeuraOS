export const DEFAULT_PERMISSION_CODES = [
  { code: "VIEW_DASHBOARD", description: "Access dashboards" },
  { code: "MANAGE_PRODUCTS", description: "Create and edit products" },
  { code: "MANAGE_PURCHASING", description: "Handle POs and receipts" },
  { code: "MANAGE_SALES", description: "Handle quotes and orders" },
  { code: "MANAGE_WAREHOUSE", description: "Adjust stock" },
  { code: "HR_ADMIN", description: "Full HR administration access" },
  { code: "HR_MANAGER", description: "Access own team HR data" },
  { code: "HR_EMPLOYEE", description: "Access own employee profile" },
  { code: "ADMIN", description: "Full administrative rights" },
] as const;
