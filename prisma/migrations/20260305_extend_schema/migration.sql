-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'INSTITUTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentStatus" ADD VALUE 'REJECTED';
ALTER TYPE "DocumentStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "DocumentStatus" ADD VALUE 'CONVERTED';
ALTER TYPE "DocumentStatus" ADD VALUE 'PARTIALLY_RECEIVED';
ALTER TYPE "DocumentStatus" ADD VALUE 'RECEIVED';

-- DropIndex
DROP INDEX "SalesQuote_companyId_quoteNumber_idx";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'INSTITUTION';

-- AlterTable
ALTER TABLE "GoodsReceiptLine" ADD COLUMN     "purchaseOrderLineId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockThreshold" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtotalAmount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "taxAmount" DECIMAL(14,2) NOT NULL;

-- AlterTable
ALTER TABLE "SalesQuote" ADD COLUMN     "subtotalAmount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "taxAmount" DECIMAL(14,2) NOT NULL;

-- AlterTable
ALTER TABLE "SalesQuoteLine" ADD COLUMN     "warehouseId" TEXT;

-- CreateTable
CREATE TABLE "SalesQuoteTaxLine" (
    "id" TEXT NOT NULL,
    "salesQuoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "taxCode" TEXT,
    "rate" DECIMAL(6,3) NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuoteTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "salesQuoteId" TEXT,
    "orderNumber" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderTaxLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "taxCode" TEXT,
    "rate" DECIMAL(6,3) NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderTaxLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "taxCode" TEXT,
    "rate" DECIMAL(6,3) NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesQuoteTaxLine_salesQuoteId_idx" ON "SalesQuoteTaxLine"("salesQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_salesQuoteId_key" ON "SalesOrder"("salesQuoteId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_idx" ON "SalesOrder"("companyId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_status_idx" ON "SalesOrder"("companyId", "status");

-- CreateIndex
CREATE INDEX "SalesOrder_orderDate_idx" ON "SalesOrder"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_companyId_orderNumber_key" ON "SalesOrder"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrderLine_warehouseId_idx" ON "SalesOrderLine"("warehouseId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_productId_idx" ON "SalesOrderLine"("productId");

-- CreateIndex
CREATE INDEX "SalesOrderTaxLine_salesOrderId_idx" ON "SalesOrderTaxLine"("salesOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderTaxLine_purchaseOrderId_idx" ON "PurchaseOrderTaxLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Client_companyId_clientType_idx" ON "Client"("companyId", "clientType");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuote_companyId_quoteNumber_key" ON "SalesQuote"("companyId", "quoteNumber");

-- CreateIndex
CREATE INDEX "SalesQuoteLine_warehouseId_idx" ON "SalesQuoteLine"("warehouseId");

-- AddForeignKey
ALTER TABLE "SalesQuoteLine" ADD CONSTRAINT "SalesQuoteLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuoteTaxLine" ADD CONSTRAINT "SalesQuoteTaxLine_salesQuoteId_fkey" FOREIGN KEY ("salesQuoteId") REFERENCES "SalesQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_salesQuoteId_fkey" FOREIGN KEY ("salesQuoteId") REFERENCES "SalesQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderTaxLine" ADD CONSTRAINT "SalesOrderTaxLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderTaxLine" ADD CONSTRAINT "PurchaseOrderTaxLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

