CREATE TABLE "CompanyMessagingConfig" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappPhoneNumber" TEXT,
  "whatsappBusinessAccountId" TEXT,
  "whatsappAccessTokenEncrypted" TEXT,
  "whatsappAccessTokenHint" TEXT,
  "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
  "telegramBotUsername" TEXT,
  "telegramBotTokenEncrypted" TEXT,
  "telegramBotTokenHint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyMessagingConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyMessagingConfig_companyId_key" ON "CompanyMessagingConfig"("companyId");
CREATE INDEX "CompanyMessagingConfig_companyId_idx" ON "CompanyMessagingConfig"("companyId");

ALTER TABLE "CompanyMessagingConfig"
ADD CONSTRAINT "CompanyMessagingConfig_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
