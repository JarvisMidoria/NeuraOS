-- Alter company with core localization and billing settings
ALTER TABLE "Company"
  ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en-US',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- Tax rules per tenant
CREATE TABLE "TaxRule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "rate" DECIMAL(6,3) NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxRule_companyId_code_key" ON "TaxRule"("companyId", "code");
CREATE INDEX "TaxRule_companyId_idx" ON "TaxRule"("companyId");

ALTER TABLE "TaxRule"
  ADD CONSTRAINT "TaxRule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stock policy per tenant
CREATE TABLE "StockRule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
  "defaultLowStockThreshold" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockRule_companyId_key" ON "StockRule"("companyId");

ALTER TABLE "StockRule"
  ADD CONSTRAINT "StockRule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
