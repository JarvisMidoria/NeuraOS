-- Performance indexes for high-traffic admin/dashboard filters
CREATE INDEX "SalesQuote_companyId_quoteDate_status_idx" ON "SalesQuote"("companyId", "quoteDate", "status");
CREATE INDEX "SalesQuote_companyId_status_validUntil_idx" ON "SalesQuote"("companyId", "status", "validUntil");

CREATE INDEX "SalesOrder_companyId_status_orderDate_idx" ON "SalesOrder"("companyId", "status", "orderDate");

CREATE INDEX "PurchaseOrder_companyId_status_orderDate_idx" ON "PurchaseOrder"("companyId", "status", "orderDate");
CREATE INDEX "PurchaseOrder_companyId_status_expectedDate_idx" ON "PurchaseOrder"("companyId", "status", "expectedDate");

CREATE INDEX "GoodsReceipt_companyId_status_receivedDate_idx" ON "GoodsReceipt"("companyId", "status", "receivedDate");

CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
CREATE INDEX "AuditLog_companyId_entity_createdAt_idx" ON "AuditLog"("companyId", "entity", "createdAt");
