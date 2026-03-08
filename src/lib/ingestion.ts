import {
  DocumentStatus,
  IngestionActionStatus,
  IngestionActionType,
  IngestionDocType,
  IngestionSource,
  IngestionStatus,
  Prisma,
  StockMovementType,
} from "@prisma/client";
import { read, utils } from "xlsx";
import { ApiError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { runCompanyLlm } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { preparePurchasePayload } from "@/lib/purchases/calculations";
import { getNextPurchaseOrderNumber } from "@/lib/purchases/sequencing";
import { prepareQuotePayload } from "@/lib/sales/quote-calculations";
import { getNextOrderNumber, getNextQuoteNumber } from "@/lib/sales/sequencing";
import { getCurrentStock } from "@/lib/stock-service";

const DECIMAL_ZERO = new Prisma.Decimal(0);
const DATE_PATTERNS = [
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/, // YYYY-MM-DD or YYYY/MM/DD
  /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/, // DD/MM/YYYY (preferred for slash) or DD-MM-YYYY
] as const;

type RecordRow = Record<string, string>;

type ProductActionPayload = {
  sku?: string;
  name?: string;
  description?: string;
  unitPrice?: string;
  unitOfMeasure?: string;
  lowStockThreshold?: string;
};

type PartyActionPayload = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

type DocumentLinePayload = {
  sku?: string;
  productName?: string;
  warehouseName?: string;
  quantity?: string;
  unitPrice?: string;
  taxRate?: string;
};

type DocumentActionPayload = {
  reference?: string;
  supplierName?: string;
  clientName?: string;
  status?: string;
  validUntil?: string;
  expectedDate?: string;
  orderDate?: string;
  notes?: string;
  lines: DocumentLinePayload[];
};

type StockAdjustmentActionPayload = {
  sku?: string;
  productName?: string;
  warehouseName?: string;
  quantity?: string;
  reason?: string;
};

type ActionPayload = ProductActionPayload | PartyActionPayload | DocumentActionPayload | StockAdjustmentActionPayload;

export type IngestionPreview = {
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  source: IngestionSource;
  docType: IngestionDocType;
  status: IngestionStatus;
  confidence: number;
  warnings: string[];
  actions: Array<{
    type: IngestionActionType;
    payload: ActionPayload;
  }>;
  extractedRowCount: number;
};

function normalizeKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function pick(row: RecordRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function parseDelimited(text: string): RecordRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const score = (delimiter: string) =>
    lines.slice(0, 5).reduce((acc, line) => acc + line.split(delimiter).length, 0);
  const delimiter = [",", ";", "\t", "|"]
    .map((d) => ({ d, s: score(d) }))
    .sort((a, b) => b.s - a.s)[0]?.d;

  if (!delimiter) return [];

  const split = (line: string) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const [headerLine, ...body] = lines;
  const headers = split(headerLine).map(normalizeKey);

  const rows: RecordRow[] = [];
  for (const line of body) {
    const cells = split(line);
    const row: RecordRow = {};
    headers.forEach((header, i) => {
      if (!header) return;
      row[header] = cells[i] ?? "";
    });
    if (Object.values(row).some(Boolean)) rows.push(row);
  }
  return rows;
}

function parseJsonRows(text: string): RecordRow[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
        .map((row) => {
          const normalized: RecordRow = {};
          for (const [k, v] of Object.entries(row)) {
            normalized[normalizeKey(k)] = asText(v);
          }
          return normalized;
        });
    }
  } catch {
    // noop
  }
  return [];
}

function parseSpreadsheet(buffer: Buffer) {
  const wb = read(buffer, { type: "buffer" });
  const rows: RecordRow[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const json = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    for (const rawRow of json) {
      const row: RecordRow = {};
      for (const [k, v] of Object.entries(rawRow)) {
        row[normalizeKey(k)] = asText(v);
      }
      if (Object.values(row).some(Boolean)) rows.push(row);
    }
  }
  return rows;
}

async function parsePdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } catch {
    return "";
  } finally {
    await parser.destroy();
  }
}

function isSpreadsheetFile(fileName: string, mimeType: string) {
  return (
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel")
  );
}

function isPdfFile(fileName: string, mimeType: string) {
  return fileName.endsWith(".pdf") || mimeType.includes("pdf");
}

function isJsonFile(fileName: string, mimeType: string) {
  return fileName.endsWith(".json") || mimeType.includes("json");
}

function isTextLikeFile(fileName: string, mimeType: string) {
  return (
    fileName.endsWith(".txt") ||
    fileName.endsWith(".csv") ||
    fileName.endsWith(".tsv") ||
    fileName.endsWith(".md") ||
    mimeType.startsWith("text/") ||
    mimeType.includes("csv")
  );
}

function inferDocTypeByHeaders(fileName: string | undefined, headers: string[]): IngestionDocType {
  const h = new Set(headers);
  const has = (...keys: string[]) => keys.some((key) => h.has(key));
  const file = normalizeKey(fileName ?? "");

  if (has("sku", "product_sku") && has("name", "product_name", "unit_price")) return IngestionDocType.PRODUCTS;
  if (has("client", "client_name") && !has("supplier", "supplier_name") && !has("po_number")) return IngestionDocType.CLIENTS;
  if (has("supplier", "supplier_name") && !has("client", "client_name")) return IngestionDocType.SUPPLIERS;
  if (has("quote_number", "devis", "valid_until") || file.includes("quote") || file.includes("devis")) return IngestionDocType.SALES_QUOTE;
  if (has("order_number", "sales_order") || file.includes("sales_order") || file.includes("commande")) return IngestionDocType.SALES_ORDER;
  if (has("po_number", "purchase_order") || file.includes("purchase") || file.includes("achat")) return IngestionDocType.PURCHASE_ORDER;
  if (has("receipt_number", "goods_receipt") || file.includes("receipt") || file.includes("reception")) return IngestionDocType.GOODS_RECEIPT;
  if (has("warehouse", "warehouse_name") && has("adjustment", "quantity_change", "stock_adjustment")) return IngestionDocType.STOCK_ADJUSTMENT;

  return IngestionDocType.UNKNOWN;
}

function groupBy<T>(values: T[], keyFn: (value: T) => string) {
  const map = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFn(value);
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  }
  return map;
}

function normalizeStatus(value: string): string {
  return normalizeKey(value).toUpperCase();
}

function normalizeNumericInput(value: string | undefined, fallback = "0") {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;

  // Keep digits, sign and separators, then normalize locale formats:
  // "1 234,56", "1.234,56", "$1,234.56", "1234,56" => "1234.56"
  let cleaned = raw.replace(/[^\d,.\-+]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Assume the last separator is decimal; strip the other as thousand separator.
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    cleaned = cleaned.replace(/,/g, ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }

  // Keep a single leading sign and single decimal dot.
  const sign = cleaned.startsWith("-") ? "-" : cleaned.startsWith("+") ? "+" : "";
  const unsigned = cleaned.replace(/^[+-]/, "");
  const [intPart, ...rest] = unsigned.split(".");
  const normalized = `${sign}${intPart || "0"}${rest.length ? `.${rest.join("")}` : ""}`;
  return normalized;
}

function collectNormalizationHints(rows: RecordRow[]) {
  let commaDecimalCount = 0;
  let dateCount = 0;

  for (const row of rows.slice(0, 300)) {
    for (const [key, value] of Object.entries(row)) {
      const trimmed = value?.trim();
      if (!trimmed) continue;

      const isNumericField = /(price|amount|total|tax|rate|qty|quantity|stock|threshold)/i.test(key);
      if (isNumericField && /,\d{1,6}$/.test(trimmed)) commaDecimalCount += 1;

      const isDateField = /(date|valid|expiry|expected)/i.test(key);
      if (isDateField && /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(trimmed)) dateCount += 1;
    }
  }

  return { commaDecimalCount, dateCount };
}

async function tryAiDocTypeAndHeaderMap(
  companyId: string,
  fileName: string | undefined,
  headers: string[],
  sampleRows: RecordRow[],
) {
  if (!headers.length) return null;
  try {
    const prompt = {
      task: "Classify ERP import file and map headers",
      fileName: fileName ?? null,
      headers,
      sampleRows: sampleRows.slice(0, 8),
      supportedDocTypes: [
        "PRODUCTS",
        "CLIENTS",
        "SUPPLIERS",
        "SALES_QUOTE",
        "SALES_ORDER",
        "PURCHASE_ORDER",
        "GOODS_RECEIPT",
        "STOCK_ADJUSTMENT",
        "UNKNOWN",
      ],
      requiredOutput: {
        docType: "string",
        confidence: "number_0_to_1",
        mappedHeaders: {
          canonical_field: "input_header",
        },
        warnings: ["string"],
      },
    };

    const response = await runCompanyLlm({
      companyId,
      system:
        "You classify import files for ERP ingestion. Return strict JSON only, no markdown. Only map to known canonical fields.",
      message: JSON.stringify(prompt),
    });

    const raw = response.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(raw) as {
      docType?: string;
      confidence?: number;
      mappedHeaders?: Record<string, string>;
      warnings?: string[];
    };

    if (!parsed.docType) return null;
    return {
      docType: parsed.docType,
      confidence:
        typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
          ? parsed.confidence
          : 0.65,
      mappedHeaders: parsed.mappedHeaders ?? {},
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((w) => String(w)) : [],
    };
  } catch {
    return null;
  }
}

function toActionType(raw: unknown): IngestionActionType | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (Object.values(IngestionActionType).includes(value as IngestionActionType)) {
    return value as IngestionActionType;
  }
  return null;
}

async function tryAiActionPlanFromText(input: {
  companyId: string;
  fileName?: string;
  rawText: string;
}) {
  const trimmed = input.rawText.trim();
  if (!trimmed) return null;
  try {
    const response = await runCompanyLlm({
      companyId: input.companyId,
      system:
        "You transform ERP documents into executable ingestion actions. Return strict JSON only. Never include markdown.",
      message: JSON.stringify({
        task: "Create ERP ingestion actions from unstructured text",
        fileName: input.fileName ?? null,
        rawText: trimmed.slice(0, 15_000),
        supportedDocTypes: Object.values(IngestionDocType),
        supportedActions: Object.values(IngestionActionType),
        requiredOutput: {
          docType: "IngestionDocType",
          confidence: "number_0_to_1",
          warnings: ["string"],
          actions: [
            {
              type: "IngestionActionType",
              payload: "object",
            },
          ],
        },
      }),
    });

    const raw = response.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(raw) as {
      docType?: unknown;
      confidence?: unknown;
      warnings?: unknown;
      actions?: unknown;
    };

    const docTypeRaw = String(parsed.docType ?? "").toUpperCase();
    const docType = Object.values(IngestionDocType).includes(docTypeRaw as IngestionDocType)
      ? (docTypeRaw as IngestionDocType)
      : IngestionDocType.UNKNOWN;
    const confidence =
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0.45;
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map((w) => String(w)) : [];
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const typed = entry as { type?: unknown; payload?: unknown };
            const type = toActionType(typed.type);
            if (!type) return null;
            if (!typed.payload || typeof typed.payload !== "object") return null;
            return {
              type,
              payload: typed.payload as ActionPayload,
            };
          })
          .filter((entry): entry is { type: IngestionActionType; payload: ActionPayload } => Boolean(entry))
      : [];

    return { docType, confidence, warnings, actions };
  } catch {
    return null;
  }
}

function buildActions(docType: IngestionDocType, rows: RecordRow[]): Array<{ type: IngestionActionType; payload: ActionPayload }> {
  if (!rows.length) return [];

  if (docType === IngestionDocType.PRODUCTS) {
    return rows
      .map((row) => ({
        type: IngestionActionType.UPSERT_PRODUCT,
        payload: {
          sku: pick(row, ["sku", "product_sku", "code"]),
          name: pick(row, ["name", "product_name", "label"]),
          description: pick(row, ["description", "desc"]),
          unitPrice: pick(row, ["unit_price", "price", "prix", "tarif"]),
          unitOfMeasure: pick(row, ["unit", "uom", "unit_of_measure"]),
          lowStockThreshold: pick(row, ["low_stock_threshold", "reorder_point", "min_stock"]),
        },
      }))
      .filter((entry) => asText((entry.payload as { name?: string }).name));
  }

  if (docType === IngestionDocType.CLIENTS) {
    return rows
      .map((row) => ({
        type: IngestionActionType.UPSERT_CLIENT,
        payload: {
          name: pick(row, ["client_name", "name", "client"]),
          email: pick(row, ["email", "mail"]),
          phone: pick(row, ["phone", "telephone", "tel"]),
          address: pick(row, ["address", "adresse"]),
        },
      }))
      .filter((entry) => asText((entry.payload as { name?: string }).name));
  }

  if (docType === IngestionDocType.SUPPLIERS) {
    return rows
      .map((row) => ({
        type: IngestionActionType.UPSERT_SUPPLIER,
        payload: {
          name: pick(row, ["supplier_name", "name", "supplier", "vendor"]),
          email: pick(row, ["email", "mail"]),
          phone: pick(row, ["phone", "telephone", "tel"]),
          address: pick(row, ["address", "adresse"]),
        },
      }))
      .filter((entry) => asText((entry.payload as { name?: string }).name));
  }

  if (docType === IngestionDocType.STOCK_ADJUSTMENT) {
    return rows
      .map((row) => ({
        type: IngestionActionType.ADJUST_STOCK,
        payload: {
          sku: pick(row, ["sku", "product_sku", "code"]),
          productName: pick(row, ["product_name", "name", "product"]),
          warehouseName: pick(row, ["warehouse", "warehouse_name", "entrepot"]),
          quantity: pick(row, ["quantity_change", "adjustment", "quantity", "qty", "delta"]),
          reason: pick(row, ["reason", "reference", "note"]),
        },
      }))
      .filter((entry) => asText((entry.payload as { quantity?: string }).quantity));
  }

  if (
    docType === IngestionDocType.SALES_QUOTE ||
    docType === IngestionDocType.SALES_ORDER ||
    docType === IngestionDocType.PURCHASE_ORDER
  ) {
    const keyCandidates =
      docType === IngestionDocType.PURCHASE_ORDER
        ? ["po_number", "order_number", "document_number", "reference"]
        : ["quote_number", "order_number", "document_number", "reference"];

    const grouped = groupBy(rows, (row) => {
      const explicit = pick(row, keyCandidates);
      if (explicit) return explicit;
      const fallbackParty =
        docType === IngestionDocType.PURCHASE_ORDER
          ? pick(row, ["supplier_name", "supplier", "vendor"])
          : pick(row, ["client_name", "client"]);
      return `${fallbackParty || "doc"}-${pick(row, ["date", "order_date", "quote_date"]) || "no-date"}`;
    });

    const type =
      docType === IngestionDocType.SALES_QUOTE
        ? IngestionActionType.CREATE_SALES_QUOTE
        : docType === IngestionDocType.SALES_ORDER
        ? IngestionActionType.CREATE_SALES_ORDER
        : IngestionActionType.CREATE_PURCHASE_ORDER;

    return Array.from(grouped.entries()).map(([reference, docRows]) => ({
      type,
      payload: {
        reference,
        clientName: pick(docRows[0], ["client_name", "client"]),
        supplierName: pick(docRows[0], ["supplier_name", "supplier", "vendor"]),
        status: pick(docRows[0], ["status", "document_status"]),
        validUntil: pick(docRows[0], ["valid_until", "expiry_date"]),
        expectedDate: pick(docRows[0], ["expected_date", "delivery_date"]),
        orderDate: pick(docRows[0], ["order_date", "quote_date", "date"]),
        notes: pick(docRows[0], ["notes", "note", "comment"]),
        lines: docRows.map((row) => ({
          sku: pick(row, ["sku", "product_sku", "code"]),
          productName: pick(row, ["product_name", "product", "name"]),
          warehouseName: pick(row, ["warehouse", "warehouse_name", "entrepot"]),
          quantity: pick(row, ["quantity", "qty"]),
          unitPrice: pick(row, ["unit_price", "price", "prix"]),
          taxRate: pick(row, ["tax_rate", "tax", "tva", "vat"]),
        })),
      },
    }));
  }

  return [];
}

export async function createIngestionPreview(input: {
  companyId: string;
  source: IngestionSource;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileBuffer?: Buffer;
  explicitText?: string;
}) {
  const warnings: string[] = [];
  let rows: RecordRow[] = [];
  let rawText = input.explicitText?.trim() || "";
  const fileNameLower = (input.fileName ?? "").toLowerCase();
  const mimeLower = (input.mimeType ?? "").toLowerCase();

  if (!rawText && input.fileBuffer && input.fileBuffer.length) {
    if (isSpreadsheetFile(fileNameLower, mimeLower)) {
      rows = parseSpreadsheet(input.fileBuffer);
    } else if (isPdfFile(fileNameLower, mimeLower)) {
      rawText = await parsePdfText(input.fileBuffer);
      if (!rawText) {
        warnings.push("PDF text extraction returned empty content. Upload CSV/XLSX or add instructions in message.");
      }
    } else if (isJsonFile(fileNameLower, mimeLower) || isTextLikeFile(fileNameLower, mimeLower)) {
      rawText = input.fileBuffer.toString("utf-8");
    } else {
      warnings.push("Unsupported binary format for auto-import. Please upload CSV/XLSX/PDF/TXT/JSON.");
    }
  }

  if (!rows.length && rawText) {
    if (isJsonFile(fileNameLower, mimeLower)) {
      rows = parseJsonRows(rawText);
    }
    if (!rows.length) {
      rows = parseDelimited(rawText);
    }
  }

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const normalizationHints = collectNormalizationHints(rows);
  let docType = inferDocTypeByHeaders(input.fileName, headers);
  let confidence = docType === IngestionDocType.UNKNOWN ? 0.35 : 0.72;

  const aiMapping = await tryAiDocTypeAndHeaderMap(input.companyId, input.fileName, headers, rows);
  if (aiMapping?.docType) {
    const aiDocType = aiMapping.docType.toUpperCase();
    if (Object.values(IngestionDocType).includes(aiDocType as IngestionDocType)) {
      docType = aiDocType as IngestionDocType;
      confidence = Math.max(confidence, aiMapping.confidence);
      warnings.push(...aiMapping.warnings);
    }
  }

  let actions = buildActions(docType, rows);
  if (!actions.length && rawText.trim()) {
    const aiPlan = await tryAiActionPlanFromText({
      companyId: input.companyId,
      fileName: input.fileName,
      rawText,
    });
    if (aiPlan) {
      docType = aiPlan.docType;
      confidence = Math.max(confidence, aiPlan.confidence);
      warnings.push(...aiPlan.warnings);
      actions = aiPlan.actions;
    }
  }
  if (!rows.length) {
    warnings.push("No structured rows detected. Try CSV/XLSX with header row.");
  }
  if (normalizationHints.commaDecimalCount > 0) {
    warnings.push(
      `Detected ${normalizationHints.commaDecimalCount} decimal values using comma separator. They will be auto-normalized.`,
    );
  }
  if (normalizationHints.dateCount > 0) {
    warnings.push(
      `Detected ${normalizationHints.dateCount} dates in DD/MM/YYYY-like format. They will be auto-normalized.`,
    );
  }
  if (!actions.length) {
    warnings.push("No actionable records detected from the uploaded content.");
  }

  const status = actions.length ? IngestionStatus.READY_APPLY : IngestionStatus.NEEDS_REVIEW;

  return {
    preview: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      source: input.source,
      docType,
      status,
      confidence,
      warnings: Array.from(new Set(warnings)).slice(0, 8),
      actions,
      extractedRowCount: rows.length,
    } satisfies IngestionPreview,
    extracted: {
      headers,
      rowsSample: rows.slice(0, 30),
      rowCount: rows.length,
      rawText: rawText.slice(0, 80_000),
    },
  };
}

export async function createIngestionJob(input: {
  companyId: string;
  createdByUserId?: string;
  source: IngestionSource;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileBuffer?: Buffer;
  explicitText?: string;
}) {
  const { preview, extracted } = await createIngestionPreview(input);

  const job = await prisma.ingestionJob.create({
    data: {
      companyId: input.companyId,
      createdByUserId: input.createdByUserId,
      source: input.source,
      status: preview.status,
      docType: preview.docType,
      fileName: preview.fileName,
      mimeType: preview.mimeType,
      fileSizeBytes: preview.fileSizeBytes,
      rawText: extracted.rawText,
      extractedJson: {
        headers: extracted.headers,
        rowCount: extracted.rowCount,
        rowsSample: extracted.rowsSample,
      },
      analysis: {
        confidence: preview.confidence,
        warnings: preview.warnings,
      },
      analyzedAt: new Date(),
      actions: {
        create: preview.actions.map((action) => ({
          companyId: input.companyId,
          type: action.type,
          status: IngestionActionStatus.PLANNED,
          payload: action.payload as Prisma.InputJsonValue,
        })),
      },
    },
    include: { actions: true },
  });

  await logAudit({
    companyId: input.companyId,
    userId: input.createdByUserId,
    action: "AI_INGESTION_JOB_CREATED",
    entity: "ingestion_job",
    entityId: job.id,
    metadata: {
      source: input.source,
      docType: job.docType,
      status: job.status,
      actionCount: job.actions.length,
      fileName: job.fileName,
      fileSizeBytes: job.fileSizeBytes,
    },
  });

  return job;
}

function parseDecimal(input: string | undefined, fallback = "0") {
  const safe = normalizeNumericInput(input, fallback);
  return new Prisma.Decimal(safe);
}

function parseDateOrNull(input: string | undefined) {
  const raw = input?.trim();
  if (!raw) return null;

  // 1) Explicit, locale-tolerant parsing (supports DD/MM/YYYY safely)
  for (const pattern of DATE_PATTERNS) {
    const match = raw.match(pattern);
    if (!match) continue;

    let year: number;
    let month: number;
    let day: number;

    if (pattern === DATE_PATTERNS[0]) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      // Slash/hyphen with trailing year is interpreted as DD/MM/YYYY.
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    // Guard against invalid rollovers (e.g. 31/02/2026)
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  // 2) Fallback for ISO timestamps and uncommon valid formats
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function findOrCreateClient(tx: Prisma.TransactionClient, companyId: string, clientName: string) {
  const name = clientName.trim();
  if (!name) throw new ApiError(400, "Client name is required");
  const existing = await tx.client.findFirst({ where: { companyId, name } });
  if (existing) return existing;
  return tx.client.create({ data: { companyId, name } });
}

async function findOrCreateSupplier(tx: Prisma.TransactionClient, companyId: string, supplierName: string) {
  const name = supplierName.trim();
  if (!name) throw new ApiError(400, "Supplier name is required");
  const existing = await tx.supplier.findFirst({ where: { companyId, name } });
  if (existing) return existing;
  return tx.supplier.create({ data: { companyId, name } });
}

async function resolveProductId(tx: Prisma.TransactionClient, companyId: string, sku?: string, productName?: string) {
  const trimmedSku = sku?.trim();
  if (trimmedSku) {
    const bySku = await tx.product.findFirst({ where: { companyId, sku: trimmedSku }, select: { id: true } });
    if (bySku) return bySku.id;
  }

  const trimmedName = productName?.trim();
  if (trimmedName) {
    const byName = await tx.product.findFirst({ where: { companyId, name: trimmedName }, select: { id: true } });
    if (byName) return byName.id;
  }

  throw new ApiError(400, `Product not found (sku: ${trimmedSku || "n/a"}, name: ${trimmedName || "n/a"})`);
}

async function resolveWarehouseId(tx: Prisma.TransactionClient, companyId: string, warehouseName?: string) {
  const name = warehouseName?.trim();
  if (!name) return null;
  const warehouse = await tx.warehouse.findFirst({ where: { companyId, name }, select: { id: true } });
  return warehouse?.id ?? null;
}

export async function applyIngestionJob(input: {
  companyId: string;
  jobId: string;
  actorUserId: string;
}) {
  const companySettings = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { productUnitMode: true, defaultProductUnit: true },
  });
  if (!companySettings) throw new ApiError(404, "Company not found");

  const job = await prisma.ingestionJob.findFirst({
    where: { id: input.jobId, companyId: input.companyId },
    include: { actions: { orderBy: { createdAt: "asc" } } },
  });
  if (!job) throw new ApiError(404, "Ingestion job not found");
  if (job.status === IngestionStatus.APPLIED) {
    return job;
  }
  if (!job.actions.length) {
    throw new ApiError(400, "No actions to apply for this ingestion job");
  }

  const applied = await prisma.$transaction(async (tx) => {
    for (const action of job.actions) {
      try {
        const payload = action.payload as ActionPayload;

        if (action.type === IngestionActionType.UPSERT_PRODUCT) {
          const data = payload as ProductActionPayload;
          const sku = data.sku?.trim() || data.name?.trim()?.toUpperCase().replace(/\s+/g, "-").slice(0, 32);
          const name = data.name?.trim();
          if (!sku || !name) throw new ApiError(400, "Product requires sku/name");

          const existing = await tx.product.findFirst({ where: { companyId: input.companyId, sku } });
          const upsertData = {
            name,
            description: data.description?.trim() || null,
            unitPrice: parseDecimal(data.unitPrice, existing?.unitPrice.toString() ?? "0"),
            unitOfMeasure:
              companySettings.productUnitMode === "GLOBAL"
                ? companySettings.defaultProductUnit
                : data.unitOfMeasure?.trim() || "EA",
            lowStockThreshold: data.lowStockThreshold?.trim() ? parseDecimal(data.lowStockThreshold) : null,
          };

          const product = existing
            ? await tx.product.update({ where: { id: existing.id }, data: upsertData })
            : await tx.product.create({ data: { companyId: input.companyId, sku, ...upsertData } });

          await tx.ingestionAction.update({
            where: { id: action.id },
            data: { status: IngestionActionStatus.APPLIED, result: { productId: product.id } },
          });
          continue;
        }

        if (action.type === IngestionActionType.UPSERT_CLIENT) {
          const data = payload as PartyActionPayload;
          const name = data.name?.trim();
          if (!name) throw new ApiError(400, "Client requires name");
          const existing = await tx.client.findFirst({ where: { companyId: input.companyId, name } });
          const client = existing
            ? await tx.client.update({
                where: { id: existing.id },
                data: {
                  email: data.email?.trim() || existing.email,
                  phone: data.phone?.trim() || existing.phone,
                  address: data.address?.trim() || existing.address,
                },
              })
            : await tx.client.create({
                data: {
                  companyId: input.companyId,
                  name,
                  email: data.email?.trim() || null,
                  phone: data.phone?.trim() || null,
                  address: data.address?.trim() || null,
                },
              });

          await tx.ingestionAction.update({
            where: { id: action.id },
            data: { status: IngestionActionStatus.APPLIED, result: { clientId: client.id } },
          });
          continue;
        }

        if (action.type === IngestionActionType.UPSERT_SUPPLIER) {
          const data = payload as PartyActionPayload;
          const name = data.name?.trim();
          if (!name) throw new ApiError(400, "Supplier requires name");
          const existing = await tx.supplier.findFirst({ where: { companyId: input.companyId, name } });
          const supplier = existing
            ? await tx.supplier.update({
                where: { id: existing.id },
                data: {
                  email: data.email?.trim() || existing.email,
                  phone: data.phone?.trim() || existing.phone,
                  address: data.address?.trim() || existing.address,
                },
              })
            : await tx.supplier.create({
                data: {
                  companyId: input.companyId,
                  name,
                  email: data.email?.trim() || null,
                  phone: data.phone?.trim() || null,
                  address: data.address?.trim() || null,
                },
              });

          await tx.ingestionAction.update({
            where: { id: action.id },
            data: { status: IngestionActionStatus.APPLIED, result: { supplierId: supplier.id } },
          });
          continue;
        }

        if (action.type === IngestionActionType.CREATE_SALES_QUOTE) {
          const data = payload as DocumentActionPayload;
          const client = await findOrCreateClient(tx, input.companyId, data.clientName ?? "");
          const lineInput = (data.lines ?? [])
            .map((line) => line as { sku?: string; productName?: string; warehouseName?: string; quantity?: string; unitPrice?: string; taxRate?: string })
            .map(async (line) => {
              const productId = await resolveProductId(tx, input.companyId, line.sku, line.productName);
              const warehouseId = await resolveWarehouseId(tx, input.companyId, line.warehouseName);
              return {
                productId,
                warehouseId,
                quantity: normalizeNumericInput(line.quantity, "1"),
                unitPrice: normalizeNumericInput(line.unitPrice, "0"),
                taxes: line.taxRate ? [{ rate: normalizeNumericInput(line.taxRate, "0"), label: "VAT" }] : [],
              };
            });

          const preparedLines = await Promise.all(lineInput);
          const prepared = prepareQuotePayload(preparedLines);
          const quoteNumber = await getNextQuoteNumber(tx, input.companyId);
          const quote = await tx.salesQuote.create({
            data: {
              companyId: input.companyId,
              clientId: client.id,
              quoteNumber,
              quoteDate: parseDateOrNull(data.orderDate) ?? new Date(),
              validUntil: parseDateOrNull(data.validUntil),
              status: DocumentStatus.DRAFT,
              notes: data.notes?.trim() || null,
              createdById: input.actorUserId,
              subtotalAmount: prepared.subtotal,
              taxAmount: prepared.taxTotal,
              totalAmount: prepared.subtotal.add(prepared.taxTotal),
              lines: {
                create: prepared.lines.map((line) => ({
                  productId: line.productId,
                  warehouseId: line.warehouseId,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  lineTotal: line.lineTotal,
                })),
              },
              taxLines: {
                create: prepared.taxLines.map((line) => ({
                  label: line.label,
                  taxCode: line.taxCode,
                  rate: line.rate,
                  baseAmount: line.baseAmount,
                  taxAmount: line.taxAmount,
                })),
              },
            },
          });

          await tx.ingestionAction.update({
            where: { id: action.id },
            data: { status: IngestionActionStatus.APPLIED, result: { salesQuoteId: quote.id, quoteNumber } },
          });
          continue;
        }

        if (action.type === IngestionActionType.CREATE_SALES_ORDER) {
          const data = payload as DocumentActionPayload;
          const client = await findOrCreateClient(tx, input.companyId, data.clientName ?? "");
          const lineInput = (data.lines ?? [])
            .map((line) => line as { sku?: string; productName?: string; warehouseName?: string; quantity?: string; unitPrice?: string; taxRate?: string })
            .map(async (line) => {
              const productId = await resolveProductId(tx, input.companyId, line.sku, line.productName);
              const warehouseId = await resolveWarehouseId(tx, input.companyId, line.warehouseName);
              if (!warehouseId) throw new ApiError(400, "Sales order lines require warehouse");
              return {
                productId,
                warehouseId,
                quantity: normalizeNumericInput(line.quantity, "1"),
                unitPrice: normalizeNumericInput(line.unitPrice, "0"),
                taxes: line.taxRate ? [{ rate: normalizeNumericInput(line.taxRate, "0"), label: "VAT" }] : [],
              };
            });

          const preparedLines = await Promise.all(lineInput);
          const prepared = prepareQuotePayload(preparedLines);
          const orderNumber = await getNextOrderNumber(tx, input.companyId);

          const targetStatus = normalizeStatus(data.status ?? "") === "CONFIRMED" ? DocumentStatus.CONFIRMED : DocumentStatus.DRAFT;
          if (targetStatus === DocumentStatus.CONFIRMED) {
            for (const line of prepared.lines) {
              if (!line.warehouseId) continue;
              const available = await getCurrentStock(input.companyId, line.productId, line.warehouseId, tx);
              if (available.lt(line.quantity)) {
                throw new ApiError(409, "Insufficient stock for confirmed imported sales order");
              }
            }
          }

          const order = await tx.salesOrder.create({
            data: {
              companyId: input.companyId,
              clientId: client.id,
              orderNumber,
              orderDate: parseDateOrNull(data.orderDate) ?? new Date(),
              status: targetStatus,
              notes: data.notes?.trim() || null,
              createdById: input.actorUserId,
              confirmedById: targetStatus === DocumentStatus.CONFIRMED ? input.actorUserId : null,
              confirmedAt: targetStatus === DocumentStatus.CONFIRMED ? new Date() : null,
              subtotalAmount: prepared.subtotal,
              taxAmount: prepared.taxTotal,
              totalAmount: prepared.subtotal.add(prepared.taxTotal),
              lines: {
                create: prepared.lines.map((line) => ({
                  productId: line.productId,
                  warehouseId: line.warehouseId!,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  lineTotal: line.lineTotal,
                })),
              },
              taxLines: {
                create: prepared.taxLines.map((line) => ({
                  label: line.label,
                  taxCode: line.taxCode,
                  rate: line.rate,
                  baseAmount: line.baseAmount,
                  taxAmount: line.taxAmount,
                })),
              },
            },
            include: { lines: true },
          });

          if (targetStatus === DocumentStatus.CONFIRMED) {
            await tx.stockMovement.createMany({
              data: order.lines.map((line) => ({
                companyId: input.companyId,
                productId: line.productId,
                warehouseId: line.warehouseId,
                movementType: StockMovementType.OUTBOUND,
                quantity: line.quantity.negated(),
                reference: `SO-${order.orderNumber}`,
                movementDate: new Date(),
              })),
            });
          }

          await tx.ingestionAction.update({
            where: { id: action.id },
            data: {
              status: IngestionActionStatus.APPLIED,
              result: { salesOrderId: order.id, orderNumber, status: order.status },
            },
          });
          continue;
        }

        if (action.type === IngestionActionType.CREATE_PURCHASE_ORDER) {
          const data = payload as DocumentActionPayload;
          const supplier = await findOrCreateSupplier(tx, input.companyId, data.supplierName ?? "");

          const lineInput = (data.lines ?? [])
            .map((line) => line as { sku?: string; productName?: string; quantity?: string; unitPrice?: string; taxRate?: string })
            .map(async (line) => {
              const productId = await resolveProductId(tx, input.companyId, line.sku, line.productName);
              return {
                productId,
                quantity: normalizeNumericInput(line.quantity, "1"),
                unitPrice: normalizeNumericInput(line.unitPrice, "0"),
                taxes: line.taxRate ? [{ rate: normalizeNumericInput(line.taxRate, "0"), label: "VAT" }] : [],
              };
            });

          const preparedLines = await Promise.all(lineInput);
          const prepared = preparePurchasePayload(preparedLines);
          const poNumber = await getNextPurchaseOrderNumber(tx, input.companyId);

          const po = await tx.purchaseOrder.create({
            data: {
              companyId: input.companyId,
              supplierId: supplier.id,
              poNumber,
              orderDate: parseDateOrNull(data.orderDate) ?? new Date(),
              expectedDate: parseDateOrNull(data.expectedDate),
              status: DocumentStatus.DRAFT,
              notes: data.notes?.trim() || null,
              subtotalAmount: prepared.subtotal,
              taxAmount: prepared.taxTotal,
              totalAmount: prepared.subtotal.add(prepared.taxTotal),
              lines: {
                create: prepared.lines.map((line) => ({
                  productId: line.productId,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  lineTotal: line.lineTotal,
                })),
              },
              taxLines: {
                create: prepared.taxLines.map((line) => ({
                  label: line.label,
                  taxCode: line.taxCode,
                  rate: line.rate,
                  baseAmount: line.baseAmount,
                  taxAmount: line.taxAmount,
                })),
              },
            },
          });

          await tx.ingestionAction.update({
            where: { id: action.id },
            data: {
              status: IngestionActionStatus.APPLIED,
              result: { purchaseOrderId: po.id, poNumber },
            },
          });
          continue;
        }

        if (action.type === IngestionActionType.ADJUST_STOCK) {
          const data = payload as StockAdjustmentActionPayload;
          const productId = await resolveProductId(tx, input.companyId, data.sku, data.productName);
          const warehouseId = await resolveWarehouseId(tx, input.companyId, data.warehouseName);
          if (!warehouseId) throw new ApiError(400, "Stock adjustment requires warehouseName");
          const quantity = parseDecimal(data.quantity, "0");
          if (quantity.eq(DECIMAL_ZERO)) {
            await tx.ingestionAction.update({
              where: { id: action.id },
              data: { status: IngestionActionStatus.SKIPPED, result: { reason: "quantity=0" } },
            });
            continue;
          }

          const movement = await tx.stockMovement.create({
            data: {
              companyId: input.companyId,
              productId,
              warehouseId,
              movementType: StockMovementType.ADJUSTMENT,
              quantity,
              reference: data.reason?.trim() || "AI_IMPORT",
              movementDate: new Date(),
            },
          });

          await tx.ingestionAction.update({
            where: { id: action.id },
            data: { status: IngestionActionStatus.APPLIED, result: { movementId: movement.id } },
          });
          continue;
        }

        await tx.ingestionAction.update({
          where: { id: action.id },
          data: { status: IngestionActionStatus.SKIPPED, result: { reason: "unsupported_action_type" } },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Action failed";
        await tx.ingestionAction.update({
          where: { id: action.id },
          data: { status: IngestionActionStatus.FAILED, errorMessage: message },
        });
      }
    }

    const finalActions = await tx.ingestionAction.findMany({
      where: { jobId: job.id },
      orderBy: { createdAt: "asc" },
    });
    const appliedCount = finalActions.filter((a) => a.status === IngestionActionStatus.APPLIED).length;
    const failedCount = finalActions.filter((a) => a.status === IngestionActionStatus.FAILED).length;
    const nextStatus =
      failedCount > 0 && appliedCount === 0 ? IngestionStatus.FAILED : IngestionStatus.APPLIED;

    return tx.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: nextStatus,
        errorMessage: failedCount > 0 ? "Some ingestion actions failed. Check action errors." : null,
        appliedAt: new Date(),
      },
      include: { actions: true },
    });
  });

  await logAudit({
    companyId: input.companyId,
    userId: input.actorUserId,
    action: "AI_INGESTION_JOB_APPLIED",
    entity: "ingestion_job",
    entityId: applied.id,
    metadata: {
      actionCount: applied.actions.length,
      appliedCount: applied.actions.filter((a) => a.status === IngestionActionStatus.APPLIED).length,
      failedCount: applied.actions.filter((a) => a.status === IngestionActionStatus.FAILED).length,
      skippedCount: applied.actions.filter((a) => a.status === IngestionActionStatus.SKIPPED).length,
    },
  });

  return applied;
}

export function serializeIngestionJob(
  job:
    | (Awaited<ReturnType<typeof prisma.ingestionJob.findFirst>> & {
        actions?: Array<{
          id: string;
          type: IngestionActionType;
          status: IngestionActionStatus;
          payload: Prisma.JsonValue;
          result: Prisma.JsonValue | null;
          errorMessage: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>;
      })
    | null,
) {
  if (!job) return null;
  return {
    id: job.id,
    companyId: job.companyId,
    createdByUserId: job.createdByUserId,
    source: job.source,
    status: job.status,
    docType: job.docType,
    fileName: job.fileName,
    mimeType: job.mimeType,
    fileSizeBytes: job.fileSizeBytes,
    rawText: job.rawText,
    extractedJson: job.extractedJson,
    analysis: job.analysis,
    errorMessage: job.errorMessage,
    receivedAt: job.receivedAt,
    analyzedAt: job.analyzedAt,
    appliedAt: job.appliedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    actions:
      job.actions?.map((action) => ({
        id: action.id,
        type: action.type,
        status: action.status,
        payload: action.payload,
        result: action.result,
        errorMessage: action.errorMessage,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
      })) ?? [],
  };
}
