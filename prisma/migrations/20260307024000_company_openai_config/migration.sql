CREATE TYPE "LlmProvider" AS ENUM ('OPENAI', 'OPENAI_COMPATIBLE');

CREATE TABLE "CompanyLlmConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "LlmProvider" NOT NULL DEFAULT 'OPENAI',
    "baseUrl" TEXT,
    "encryptedApiKey" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLlmConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyLlmConfig_companyId_key" ON "CompanyLlmConfig"("companyId");

ALTER TABLE "CompanyLlmConfig" ADD CONSTRAINT "CompanyLlmConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
