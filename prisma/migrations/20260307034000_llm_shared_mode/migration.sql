CREATE TYPE "LlmAccessMode" AS ENUM ('SHARED', 'BYOK');

ALTER TABLE "CompanyLlmConfig"
ADD COLUMN "accessMode" "LlmAccessMode" NOT NULL DEFAULT 'SHARED';

ALTER TABLE "CompanyLlmConfig"
ALTER COLUMN "encryptedApiKey" DROP NOT NULL,
ALTER COLUMN "keyHint" DROP NOT NULL;
