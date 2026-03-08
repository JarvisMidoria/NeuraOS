-- CreateEnum
CREATE TYPE "IngestionSource" AS ENUM ('WEB_UPLOAD', 'COPILOT_CHAT', 'TELEGRAM', 'WHATSAPP', 'API');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RECEIVED', 'ANALYZED', 'READY_APPLY', 'APPLIED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionDocType" AS ENUM ('UNKNOWN', 'PRODUCTS', 'CLIENTS', 'SUPPLIERS', 'SALES_QUOTE', 'SALES_ORDER', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "IngestionActionType" AS ENUM ('UPSERT_PRODUCT', 'UPSERT_CLIENT', 'UPSERT_SUPPLIER', 'CREATE_SALES_QUOTE', 'CREATE_SALES_ORDER', 'CREATE_PURCHASE_ORDER', 'CREATE_GOODS_RECEIPT', 'ADJUST_STOCK');

-- CreateEnum
CREATE TYPE "IngestionActionStatus" AS ENUM ('PLANNED', 'APPLIED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "source" "IngestionSource" NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'RECEIVED',
    "docType" "IngestionDocType" NOT NULL DEFAULT 'UNKNOWN',
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "rawText" TEXT,
    "extractedJson" JSONB,
    "analysis" JSONB,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionAction" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "IngestionActionType" NOT NULL,
    "status" "IngestionActionStatus" NOT NULL DEFAULT 'PLANNED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionJob_companyId_createdAt_idx" ON "IngestionJob"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJob_companyId_status_idx" ON "IngestionJob"("companyId", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_companyId_docType_createdAt_idx" ON "IngestionJob"("companyId", "docType", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionAction_jobId_status_idx" ON "IngestionAction"("jobId", "status");

-- CreateIndex
CREATE INDEX "IngestionAction_companyId_type_createdAt_idx" ON "IngestionAction"("companyId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionAction" ADD CONSTRAINT "IngestionAction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionAction" ADD CONSTRAINT "IngestionAction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
