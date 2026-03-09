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
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Company'
        AND column_name = '__productUnitMode_new'
    ) THEN
      ALTER TABLE "Company"
        ADD COLUMN "__productUnitMode_new" "ProductUnitMode" NOT NULL DEFAULT 'PER_PRODUCT';
    END IF;

    UPDATE "Company"
    SET "__productUnitMode_new" = CASE
      WHEN "productUnitMode" IS NULL THEN 'PER_PRODUCT'::"ProductUnitMode"
      WHEN UPPER("productUnitMode"::text) = 'GLOBAL' THEN 'GLOBAL'::"ProductUnitMode"
      WHEN UPPER("productUnitMode"::text) = 'PER_PRODUCT' THEN 'PER_PRODUCT'::"ProductUnitMode"
      ELSE 'PER_PRODUCT'::"ProductUnitMode"
    END;

    ALTER TABLE "Company" DROP COLUMN "productUnitMode";
    ALTER TABLE "Company" RENAME COLUMN "__productUnitMode_new" TO "productUnitMode";
  END IF;
END $$;

ALTER TABLE "Company"
  ALTER COLUMN "productUnitMode" SET DEFAULT 'PER_PRODUCT';
