export const DEFAULT_PERMISSION_CODES = [
  { code: "VIEW_DASHBOARD", description: "Access dashboards" },
  { code: "MANAGE_PRODUCTS", description: "Create and edit products" },
  { code: "MANAGE_PURCHASING", description: "Handle POs and receipts" },
  { code: "MANAGE_SALES", description: "Handle quotes and orders" },
  { code: "MANAGE_WAREHOUSE", description: "Adjust stock" },
  { code: "ADMIN", description: "Full administrative rights" },
] as const;
