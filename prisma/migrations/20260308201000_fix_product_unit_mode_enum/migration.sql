UPDATE "Company"
SET "productUnitMode" = 'PER_PRODUCT'
WHERE "productUnitMode" IS NULL OR "productUnitMode" NOT IN ('GLOBAL', 'PER_PRODUCT');

DO $$
BEGIN
  CREATE TYPE "ProductUnitMode" AS ENUM ('GLOBAL', 'PER_PRODUCT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Company"
  ALTER COLUMN "productUnitMode" TYPE "ProductUnitMode" USING ("productUnitMode"::"ProductUnitMode"),
  ALTER COLUMN "productUnitMode" SET DEFAULT 'PER_PRODUCT';
