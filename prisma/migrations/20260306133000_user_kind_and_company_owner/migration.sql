-- Add formal user hierarchy: Master / Tenant Admin / Tenant Member
CREATE TYPE "UserKind" AS ENUM ('MASTER', 'TENANT_ADMIN', 'TENANT_MEMBER');

ALTER TABLE "User"
  ADD COLUMN "kind" "UserKind" NOT NULL DEFAULT 'TENANT_MEMBER';

ALTER TABLE "Company"
  ADD COLUMN "ownerUserId" TEXT;

-- Backfill owner with first Admin role user in each company when available.
WITH ranked_admins AS (
  SELECT
    ur."companyId",
    ur."userId",
    ROW_NUMBER() OVER (PARTITION BY ur."companyId" ORDER BY u."createdAt" ASC) AS rn
  FROM "UserRole" ur
  INNER JOIN "Role" r ON r."id" = ur."roleId"
  INNER JOIN "User" u ON u."id" = ur."userId"
  WHERE r."name" = 'Admin'
)
UPDATE "Company" c
SET "ownerUserId" = ra."userId"
FROM ranked_admins ra
WHERE c."id" = ra."companyId"
  AND ra.rn = 1;

-- Promote tenant owners to TENANT_ADMIN.
UPDATE "User" u
SET "kind" = 'TENANT_ADMIN'
FROM "Company" c
WHERE c."ownerUserId" = u."id";

CREATE UNIQUE INDEX "Company_ownerUserId_key" ON "Company"("ownerUserId");
ALTER TABLE "Company"
  ADD CONSTRAINT "Company_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
