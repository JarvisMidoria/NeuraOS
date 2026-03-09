import { EmployeeContractType, EmployeeStatus, HrDocumentType, Prisma } from "@prisma/client";
import { read, utils } from "xlsx";
import { ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type RecordRow = Record<string, string>;

export type HrImportDocType =
  | "ENTITIES"
  | "LOCATIONS"
  | "DEPARTMENTS"
  | "POSITIONS"
  | "EMPLOYEES"
  | "EMPLOYEE_HISTORY"
  | "EMPLOYEE_DOCUMENTS"
  | "UNKNOWN";

export interface HrImportPreview {
  docType: HrImportDocType;
  rowCount: number;
  warnings: string[];
  sampleHeaders: string[];
}

export interface HrImportApplyResult {
  docType: HrImportDocType;
  rowCount: number;
  applied: number;
  skipped: number;
  failed: number;
  warnings: string[];
  errors: string[];
}

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

  const score = (delimiter: string) => lines.slice(0, 8).reduce((acc, line) => acc + line.split(delimiter).length, 0);
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

function parseSpreadsheet(buffer: Buffer): RecordRow[] {
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

function parseJsonRows(text: string): RecordRow[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((raw) => {
        const row: RecordRow = {};
        for (const [k, v] of Object.entries(raw)) {
          row[normalizeKey(k)] = asText(v);
        }
        return row;
      });
  } catch {
    return [];
  }
}

function isSpreadsheetFile(fileName: string, mimeType: string) {
  return fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || mimeType.includes("spreadsheet") || mimeType.includes("excel");
}

function isJsonFile(fileName: string, mimeType: string) {
  return fileName.endsWith(".json") || mimeType.includes("json");
}

function inferDocTypeByHeaders(fileName: string | undefined, headers: string[]): HrImportDocType {
  const h = new Set(headers);
  const has = (...keys: string[]) => keys.some((key) => h.has(key));
  const file = normalizeKey(fileName ?? "");

  if (has("entity_name", "legal_name", "entity_code") || file.includes("entities")) return "ENTITIES";
  if (has("location_name", "city", "country") || file.includes("locations")) return "LOCATIONS";
  if (has("department_name", "department_code") || file.includes("departments")) return "DEPARTMENTS";
  if (has("position_title", "position_level") || file.includes("positions")) return "POSITIONS";
  if (has("first_name", "last_name", "hire_date") || file.includes("employees")) return "EMPLOYEES";
  if (has("employee_email", "start_date") || file.includes("history")) return "EMPLOYEE_HISTORY";
  if (has("employee_email", "document_type", "document_name") || file.includes("documents")) return "EMPLOYEE_DOCUMENTS";

  return "UNKNOWN";
}

function parseDateOrNull(input: string | undefined) {
  const raw = input?.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return date;
  }

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseDecimalOrNull(input: string | undefined) {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/,(?=\d{1,6}$)/, ".")
    .replace(/,/g, "");
  try {
    return new Prisma.Decimal(normalized);
  } catch {
    return null;
  }
}

function normalizeEmployeeStatus(input: string | undefined): EmployeeStatus {
  const normalized = (input ?? "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "LEFT" || normalized === "SUSPENDED") return normalized;
  if (normalized === "INACTIVE") return "SUSPENDED";
  return "ACTIVE";
}

function normalizeContractType(input: string | undefined): EmployeeContractType {
  const normalized = (input ?? "").trim().toUpperCase();
  switch (normalized) {
    case "PERMANENT":
    case "FIXED_TERM":
    case "FREELANCE":
    case "INTERN":
    case "TEMPORARY":
    case "OTHER":
      return normalized;
    case "CDD":
      return "FIXED_TERM";
    case "CDI":
      return "PERMANENT";
    default:
      return "PERMANENT";
  }
}

function normalizeDocumentType(input: string | undefined): HrDocumentType {
  const normalized = (input ?? "").trim().toUpperCase();
  switch (normalized) {
    case "CONTRACT":
    case "IDENTITY":
    case "PAYSLIP":
    case "CERTIFICATE":
    case "INTERNAL":
    case "OTHER":
      return normalized;
    case "ID":
    case "CIN":
      return "IDENTITY";
    default:
      return "OTHER";
  }
}

export async function parseHrImportFile(input: {
  fileName?: string;
  mimeType?: string;
  fileBuffer: Buffer;
}) {
  const fileNameLower = (input.fileName ?? "").toLowerCase();
  const mimeLower = (input.mimeType ?? "").toLowerCase();

  let rows: RecordRow[] = [];
  if (isSpreadsheetFile(fileNameLower, mimeLower)) {
    rows = parseSpreadsheet(input.fileBuffer);
  } else if (isJsonFile(fileNameLower, mimeLower)) {
    rows = parseJsonRows(input.fileBuffer.toString("utf-8"));
  } else {
    rows = parseDelimited(input.fileBuffer.toString("utf-8"));
  }

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const docType = inferDocTypeByHeaders(input.fileName, headers);
  const warnings: string[] = [];

  if (!rows.length) warnings.push("No structured rows detected. Use CSV/XLSX/JSON/TXT with headers.");
  if (docType === "UNKNOWN") warnings.push("Could not detect HR file type automatically.");

  return { rows, headers, docType, warnings };
}

export async function previewHrImport(input: {
  fileName?: string;
  mimeType?: string;
  fileBuffer: Buffer;
}): Promise<HrImportPreview> {
  const parsed = await parseHrImportFile(input);
  return {
    docType: parsed.docType,
    rowCount: parsed.rows.length,
    warnings: parsed.warnings,
    sampleHeaders: parsed.headers,
  };
}

export async function applyHrImport(input: {
  companyId: string;
  actorUserId: string;
  fileName?: string;
  mimeType?: string;
  fileBuffer: Buffer;
}): Promise<HrImportApplyResult> {
  const parsed = await parseHrImportFile(input);
  const errors: string[] = [];
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  if (!parsed.rows.length || parsed.docType === "UNKNOWN") {
    return {
      docType: parsed.docType,
      rowCount: parsed.rows.length,
      applied,
      skipped,
      failed: Math.max(1, failed),
      warnings: parsed.warnings,
      errors: ["Unsupported or empty HR file."],
    };
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.docType === "ENTITIES") {
      for (const row of parsed.rows) {
        try {
          const name = pick(row, ["entity_name", "name"]);
          if (!name) {
            skipped += 1;
            continue;
          }
          const existing = await tx.entity.findFirst({ where: { companyId: input.companyId, name } });
          if (existing) {
            await tx.entity.update({
              where: { id: existing.id },
              data: {
                legalName: pick(row, ["legal_name"]) || existing.legalName,
                code: pick(row, ["entity_code", "code"]) || existing.code,
                isActive: ["1", "true", "yes", "active"].includes(pick(row, ["is_active"]).toLowerCase()) || existing.isActive,
              },
            });
          } else {
            await tx.entity.create({
              data: {
                companyId: input.companyId,
                name,
                legalName: pick(row, ["legal_name"]) || null,
                code: pick(row, ["entity_code", "code"]) || null,
                isActive: !["0", "false", "no", "inactive"].includes(pick(row, ["is_active"]).toLowerCase()),
              },
            });
          }
          applied += 1;
        } catch (error) {
          failed += 1;
          errors.push(error instanceof Error ? error.message : "Entity row failed");
        }
      }
      return;
    }

    if (parsed.docType === "LOCATIONS") {
      for (const row of parsed.rows) {
        try {
          const name = pick(row, ["location_name", "name"]);
          if (!name) {
            skipped += 1;
            continue;
          }
          const existing = await tx.location.findFirst({ where: { companyId: input.companyId, name } });
          if (existing) {
            await tx.location.update({
              where: { id: existing.id },
              data: {
                address: pick(row, ["address"]) || existing.address,
                city: pick(row, ["city"]) || existing.city,
                country: pick(row, ["country"]) || existing.country,
              },
            });
          } else {
            await tx.location.create({
              data: {
                companyId: input.companyId,
                name,
                address: pick(row, ["address"]) || null,
                city: pick(row, ["city"]) || null,
                country: pick(row, ["country"]) || null,
              },
            });
          }
          applied += 1;
        } catch (error) {
          failed += 1;
          errors.push(error instanceof Error ? error.message : "Location row failed");
        }
      }
      return;
    }

    if (parsed.docType === "DEPARTMENTS") {
      for (const row of parsed.rows) {
        try {
          const name = pick(row, ["department_name", "name"]);
          if (!name) {
            skipped += 1;
            continue;
          }
          const entityName = pick(row, ["entity_name"]);
          const managerEmail = pick(row, ["manager_email", "manager"]);

          const entity = entityName
            ? await tx.entity.findFirst({ where: { companyId: input.companyId, name: entityName }, select: { id: true } })
            : null;
          const manager = managerEmail
            ? await tx.employee.findFirst({ where: { companyId: input.companyId, email: managerEmail.toLowerCase() }, select: { id: true } })
            : null;

          const existing = await tx.department.findFirst({ where: { companyId: input.companyId, name } });
          if (existing) {
            await tx.department.update({
              where: { id: existing.id },
              data: {
                code: pick(row, ["department_code", "code"]) || existing.code,
                entityId: entity?.id ?? existing.entityId,
                managerEmployeeId: manager?.id ?? existing.managerEmployeeId,
              },
            });
          } else {
            await tx.department.create({
              data: {
                companyId: input.companyId,
                name,
                code: pick(row, ["department_code", "code"]) || null,
                entityId: entity?.id ?? null,
                managerEmployeeId: manager?.id ?? null,
              },
            });
          }
          applied += 1;
        } catch (error) {
          failed += 1;
          errors.push(error instanceof Error ? error.message : "Department row failed");
        }
      }
      return;
    }

    if (parsed.docType === "POSITIONS") {
      for (const row of parsed.rows) {
        try {
          const title = pick(row, ["position_title", "title", "position"]);
          if (!title) {
            skipped += 1;
            continue;
          }
          const departmentName = pick(row, ["department_name"]);
          const department = departmentName
            ? await tx.department.findFirst({ where: { companyId: input.companyId, name: departmentName }, select: { id: true } })
            : null;

          const existing = await tx.position.findFirst({ where: { companyId: input.companyId, title } });
          if (existing) {
            await tx.position.update({
              where: { id: existing.id },
              data: {
                level: pick(row, ["position_level", "level"]) || existing.level,
                departmentId: department?.id ?? existing.departmentId,
              },
            });
          } else {
            await tx.position.create({
              data: {
                companyId: input.companyId,
                title,
                level: pick(row, ["position_level", "level"]) || null,
                departmentId: department?.id ?? null,
              },
            });
          }
          applied += 1;
        } catch (error) {
          failed += 1;
          errors.push(error instanceof Error ? error.message : "Position row failed");
        }
      }
      return;
    }

    if (parsed.docType === "EMPLOYEES") {
      // pass 1: create/update without manager dependency
      const managerLinks: Array<{ email: string; managerEmail: string }> = [];

      for (const row of parsed.rows) {
        try {
          const email = pick(row, ["email", "employee_email"]).toLowerCase();
          const firstName = pick(row, ["first_name", "firstname"]);
          const lastName = pick(row, ["last_name", "lastname"]);
          const hireDate = parseDateOrNull(pick(row, ["hire_date", "start_date"]));
          if (!email || !firstName || !lastName || !hireDate) {
            skipped += 1;
            continue;
          }

          const departmentName = pick(row, ["department_name"]);
          const positionTitle = pick(row, ["position_title", "position"]);
          const locationName = pick(row, ["location_name"]);
          const entityName = pick(row, ["entity_name"]);

          const [department, position, location, entity] = await Promise.all([
            departmentName
              ? tx.department.findFirst({ where: { companyId: input.companyId, name: departmentName }, select: { id: true } })
              : Promise.resolve(null),
            positionTitle
              ? tx.position.findFirst({ where: { companyId: input.companyId, title: positionTitle }, select: { id: true } })
              : Promise.resolve(null),
            locationName
              ? tx.location.findFirst({ where: { companyId: input.companyId, name: locationName }, select: { id: true } })
              : Promise.resolve(null),
            entityName
              ? tx.entity.findFirst({ where: { companyId: input.companyId, name: entityName }, select: { id: true } })
              : Promise.resolve(null),
          ]);

          const existing = await tx.employee.findFirst({ where: { companyId: input.companyId, email } });
          const salary = parseDecimalOrNull(pick(row, ["salary"]));

          const data = {
            employeeCode: pick(row, ["employee_code", "code"]) || null,
            firstName,
            lastName,
            email,
            phone: pick(row, ["phone", "mobile"]) || null,
            dateOfBirth: parseDateOrNull(pick(row, ["date_of_birth", "dob"])),
            address: pick(row, ["address"]) || null,
            hireDate,
            contractType: normalizeContractType(pick(row, ["contract_type", "contract"])),
            status: normalizeEmployeeStatus(pick(row, ["status"])),
            salary,
            departmentId: department?.id ?? null,
            positionId: position?.id ?? null,
            locationId: location?.id ?? null,
            entityId: entity?.id ?? null,
          };

          const employee = existing
            ? await tx.employee.update({ where: { id: existing.id }, data })
            : await tx.employee.create({ data: { companyId: input.companyId, ...data } });

          const managerEmail = pick(row, ["manager_email", "manager"]);
          if (managerEmail) managerLinks.push({ email, managerEmail: managerEmail.toLowerCase() });

          await tx.employeePositionHistory.create({
            data: {
              companyId: input.companyId,
              employeeId: employee.id,
              departmentId: employee.departmentId,
              positionId: employee.positionId,
              locationId: employee.locationId,
              entityId: employee.entityId,
              managerId: employee.managerId,
              status: employee.status,
              contractType: employee.contractType,
              salary: employee.salary,
              startDate: employee.hireDate,
              notes: "Imported from HR Import Center",
            },
          });

          applied += 1;
        } catch (error) {
          failed += 1;
          errors.push(error instanceof Error ? error.message : "Employee row failed");
        }
      }

      // pass 2: set managers
      for (const link of managerLinks) {
        try {
          const [employee, manager] = await Promise.all([
            tx.employee.findFirst({ where: { companyId: input.companyId, email: link.email }, select: { id: true } }),
            tx.employee.findFirst({ where: { companyId: input.companyId, email: link.managerEmail }, select: { id: true } }),
          ]);
          if (!employee || !manager || employee.id === manager.id) continue;
          await tx.employee.update({ where: { id: employee.id }, data: { managerId: manager.id } });
        } catch {
          // non-blocking manager link
        }
      }
      return;
    }

    if (parsed.docType === "EMPLOYEE_HISTORY") {
      for (const row of parsed.rows) {
        try {
          const employeeEmail = pick(row, ["employee_email", "email"]).toLowerCase();
          const employee = employeeEmail
            ? await tx.employee.findFirst({ where: { companyId: input.companyId, email: employeeEmail }, select: { id: true } })
            : null;
          const startDate = parseDateOrNull(pick(row, ["start_date"]));

          if (!employee || !startDate) {
            skipped += 1;
            continue;
          }

          const [department, position, location, entity, manager] = await Promise.all([
            pick(row, ["department_name"])
              ? tx.department.findFirst({ where: { companyId: input.companyId, name: pick(row, ["department_name"]) }, select: { id: true } })
              : Promise.resolve(null),
            pick(row, ["position_title", "position"])
              ? tx.position.findFirst({ where: { companyId: input.companyId, title: pick(row, ["position_title", "position"]) }, select: { id: true } })
              : Promise.resolve(null),
            pick(row, ["location_name"])
              ? tx.location.findFirst({ where: { companyId: input.companyId, name: pick(row, ["location_name"]) }, select: { id: true } })
              : Promise.resolve(null),
            pick(row, ["entity_name"])
              ? tx.entity.findFirst({ where: { companyId: input.companyId, name: pick(row, ["entity_name"]) }, select: { id: true } })
              : Promise.resolve(null),
            pick(row, ["manager_email", "manager"])
              ? tx.employee.findFirst({ where: { companyId: input.companyId, email: pick(row, ["manager_email", "manager"]).toLowerCase() }, select: { id: true } })
              : Promise.resolve(null),
          ]);

          await tx.employeePositionHistory.create({
            data: {
              companyId: input.companyId,
              employeeId: employee.id,
              departmentId: department?.id ?? null,
              positionId: position?.id ?? null,
              locationId: location?.id ?? null,
              entityId: entity?.id ?? null,
              managerId: manager?.id ?? null,
              status: normalizeEmployeeStatus(pick(row, ["status"])),
              contractType: normalizeContractType(pick(row, ["contract_type", "contract"])),
              salary: parseDecimalOrNull(pick(row, ["salary"])),
              startDate,
              endDate: parseDateOrNull(pick(row, ["end_date"])),
              notes: pick(row, ["note", "notes"]) || null,
            },
          });

          applied += 1;
        } catch (error) {
          failed += 1;
          errors.push(error instanceof Error ? error.message : "Employee history row failed");
        }
      }
      return;
    }

    if (parsed.docType === "EMPLOYEE_DOCUMENTS") {
      for (const row of parsed.rows) {
        try {
          const employeeEmail = pick(row, ["employee_email", "email"]).toLowerCase();
          const employee = employeeEmail
            ? await tx.employee.findFirst({ where: { companyId: input.companyId, email: employeeEmail }, select: { id: true } })
            : null;
          if (!employee) {
            skipped += 1;
            continue;
          }

          const documentType = normalizeDocumentType(pick(row, ["document_type", "type"]));
          const documentName = pick(row, ["document_name", "name", "title"]);
          const fileUrl = pick(row, ["file_url", "url"]);
          if (!documentName || !fileUrl) {
            skipped += 1;
            continue;
          }

          await tx.employeeDocument.create({
            data: {
              companyId: input.companyId,
              employeeId: employee.id,
              uploadedByUserId: input.actorUserId,
              type: documentType,
              fileName: documentName,
              fileUrl,
              issuedAt: parseDateOrNull(pick(row, ["issued_at"])),
              expiresAt: parseDateOrNull(pick(row, ["expires_at"])),
            },
          });

          applied += 1;
        } catch (error) {
          failed += 1;
          errors.push(error instanceof Error ? error.message : "Employee document row failed");
        }
      }
      return;
    }
  });

  return {
    docType: parsed.docType,
    rowCount: parsed.rows.length,
    applied,
    skipped,
    failed,
    warnings: parsed.warnings,
    errors: errors.slice(0, 30),
  };
}

export function ensureAllowedHrImportType(docType: HrImportDocType) {
  if (docType === "UNKNOWN") {
    throw new ApiError(400, "Could not identify this HR file type");
  }
}
