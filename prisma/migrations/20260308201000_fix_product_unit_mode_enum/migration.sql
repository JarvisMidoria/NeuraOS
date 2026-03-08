UPDATE "Company"
SET "productUnitMode" = 'PER_PRODUCT'
WHERE "productUnitMode" IS NULL
   OR UPPER("productUnitMode") NOT IN ('GLOBAL', 'PER_PRODUCT');

UPDATE "Company"
SET "productUnitMode" = UPPER("productUnitMode")
WHERE "productUnitMode" IN ('global', 'per_product');

DO $$
BEGIN
  CREATE TYPE "ProductUnitMode" AS ENUM ('GLOBAL', 'PER_PRODUCT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Company'
      AND column_name = 'productUnitMode'
      AND udt_name <> 'ProductUnitMode'
  ) THEN
    ALTER TABLE "Company"
      ALTER COLUMN "productUnitMode" TYPE "ProductUnitMode"
      USING (UPPER("productUnitMode")::"ProductUnitMode");
  END IF;
END $$;

ALTER TABLE "Company"
  ALTER COLUMN "productUnitMode" SET DEFAULT 'PER_PRODUCT';
