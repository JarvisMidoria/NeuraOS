import { IngestionActionType, IngestionDocType, IngestionSource, IngestionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", () => ({
  runCompanyLlm: vi.fn().mockRejectedValue(new Error("LLM disabled for test")),
  runCompanyLlmWithImage: vi.fn().mockRejectedValue(new Error("LLM disabled for test")),
}));

import { createIngestionPreview } from "@/lib/ingestion";

describe("createIngestionPreview", () => {
  it("infers SALES_QUOTE and reports normalization warnings for comma decimals and DD/MM/YYYY dates", async () => {
    const explicitText = [
      "quote_number;client_name;sku;product_name;quantity;unit_price;tax_rate;valid_until",
      "Q-2026-001;TextiCo Retail;TXT-COT-180;Coton Bio 180g;120;8,75;20;11/03/2026",
      "Q-2026-001;TextiCo Retail;TXT-DEN-RAW;Denim Brut Indigo;80;11,40;20;11/03/2026",
    ].join("\n");

    const { preview, extracted } = await createIngestionPreview({
      companyId: "company-1",
      source: IngestionSource.WEB_UPLOAD,
      fileName: "sales_quotes.csv",
      mimeType: "text/csv",
      explicitText,
    });

    expect(preview.docType).toBe(IngestionDocType.SALES_QUOTE);
    expect(preview.status).toBe(IngestionStatus.READY_APPLY);
    expect(preview.actions).toHaveLength(1);
    expect(preview.actions[0]?.type).toBe(IngestionActionType.CREATE_SALES_QUOTE);
    expect(preview.actions[0]?.payload).toMatchObject({
      reference: "Q-2026-001",
      clientName: "TextiCo Retail",
    });
    expect(preview.warnings.join(" ")).toContain("decimal values using comma separator");
    expect(preview.warnings.join(" ")).toContain("dates in DD/MM/YYYY-like format");
    expect(extracted.rowCount).toBe(2);
  });

  it("infers PRODUCTS and creates one UPSERT action per row", async () => {
    const explicitText = [
      "sku,name,unit_price,low_stock_threshold,unit",
      "TXT-LIN-NAT,Lin Naturel Premium,15.2,60,M",
      "TXT-SAT-BLK,Satin Noir,10.4,45,M",
    ].join("\n");

    const { preview } = await createIngestionPreview({
      companyId: "company-1",
      source: IngestionSource.WEB_UPLOAD,
      fileName: "products.csv",
      mimeType: "text/csv",
      explicitText,
    });

    expect(preview.docType).toBe(IngestionDocType.PRODUCTS);
    expect(preview.status).toBe(IngestionStatus.READY_APPLY);
    expect(preview.actions).toHaveLength(2);
    expect(preview.actions[0]?.type).toBe(IngestionActionType.UPSERT_PRODUCT);
    expect(preview.actions[1]?.type).toBe(IngestionActionType.UPSERT_PRODUCT);
  });
});
