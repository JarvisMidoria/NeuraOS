CREATE TYPE "BillingEventType" AS ENUM (
  'CHECKOUT_COMPLETED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_CANCELED',
  'INVOICE_PAID',
  'INVOICE_PAYMENT_FAILED'
);

CREATE TYPE "BillingEventStatus" AS ENUM ('INFO', 'SUCCEEDED', 'FAILED');

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "stripeEventId" TEXT,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "stripeInvoiceId" TEXT,
  "type" "BillingEventType" NOT NULL,
  "status" "BillingEventStatus" NOT NULL DEFAULT 'INFO',
  "plan" "SubscriptionPlan",
  "amount" DECIMAL(14,2),
  "currencyCode" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");
CREATE INDEX "BillingEvent_companyId_occurredAt_idx" ON "BillingEvent"("companyId", "occurredAt");
CREATE INDEX "BillingEvent_type_occurredAt_idx" ON "BillingEvent"("type", "occurredAt");
CREATE INDEX "BillingEvent_status_occurredAt_idx" ON "BillingEvent"("status", "occurredAt");
CREATE INDEX "BillingEvent_stripeSubscriptionId_idx" ON "BillingEvent"("stripeSubscriptionId");
CREATE INDEX "BillingEvent_stripeCustomerId_idx" ON "BillingEvent"("stripeCustomerId");

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
