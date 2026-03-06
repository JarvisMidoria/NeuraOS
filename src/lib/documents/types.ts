export type DocumentTemplateId = "clean" | "compact";

export type DocumentRow = {
  label: string;
  quantity?: string;
  unitPrice?: string;
  total?: string;
  meta?: string;
};

export type DocumentModel = {
  title: string;
  code: string;
  issueDate: string;
  dueDate?: string | null;
  companyName: string;
  companyMeta?: string;
  counterpartLabel: string;
  counterpartName: string;
  counterpartMeta?: string;
  notes?: string | null;
  rows: DocumentRow[];
  totals?: Array<{ label: string; value: string }>;
};
