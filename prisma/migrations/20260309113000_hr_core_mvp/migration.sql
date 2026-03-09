-- HR Core MVP: entities, org structure, employees, history, documents

DO $$
BEGIN
  CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'LEFT', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "EmployeeContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'FREELANCE', 'INTERN', 'TEMPORARY', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "HrDocumentType" AS ENUM ('CONTRACT', 'IDENTITY', 'PAYSLIP', 'CERTIFICATE', 'INTERNAL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Entity" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Department" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entityId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "managerEmployeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Position" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "departmentId" TEXT,
  "title" TEXT NOT NULL,
  "level" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Employee" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "employeeCode" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "address" TEXT,
  "hireDate" TIMESTAMP(3) NOT NULL,
  "contractType" "EmployeeContractType" NOT NULL DEFAULT 'PERMANENT',
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "salary" DECIMAL(14,2),
  "managerId" TEXT,
  "departmentId" TEXT,
  "positionId" TEXT,
  "locationId" TEXT,
  "entityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeePositionHistory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "departmentId" TEXT,
  "positionId" TEXT,
  "locationId" TEXT,
  "entityId" TEXT,
  "managerId" TEXT,
  "status" "EmployeeStatus" NOT NULL,
  "contractType" "EmployeeContractType" NOT NULL,
  "salary" DECIMAL(14,2),
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePositionHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" "HrDocumentType" NOT NULL DEFAULT 'OTHER',
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT,
  "mimeType" TEXT,
  "notes" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Entity_companyId_name_key" ON "Entity"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Entity_companyId_idx" ON "Entity"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "Department_companyId_name_key" ON "Department"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Department_companyId_idx" ON "Department"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "Position_companyId_title_key" ON "Position"("companyId", "title");
CREATE INDEX IF NOT EXISTS "Position_companyId_idx" ON "Position"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "Location_companyId_name_key" ON "Location"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Location_companyId_idx" ON "Location"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_companyId_email_key" ON "Employee"("companyId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_companyId_employeeCode_key" ON "Employee"("companyId", "employeeCode");
CREATE INDEX IF NOT EXISTS "Employee_companyId_status_idx" ON "Employee"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Employee_companyId_managerId_idx" ON "Employee"("companyId", "managerId");

CREATE INDEX IF NOT EXISTS "EmployeePositionHistory_companyId_employeeId_startDate_idx" ON "EmployeePositionHistory"("companyId", "employeeId", "startDate");
CREATE INDEX IF NOT EXISTS "EmployeeDocument_companyId_employeeId_createdAt_idx" ON "EmployeeDocument"("companyId", "employeeId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "Entity"
    ADD CONSTRAINT "Entity_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Department"
    ADD CONSTRAINT "Department_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Department"
    ADD CONSTRAINT "Department_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Position"
    ADD CONSTRAINT "Position_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Position"
    ADD CONSTRAINT "Position_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Location"
    ADD CONSTRAINT "Location_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Department"
    ADD CONSTRAINT "Department_managerEmployeeId_fkey"
    FOREIGN KEY ("managerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeePositionHistory"
    ADD CONSTRAINT "EmployeePositionHistory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeePositionHistory"
    ADD CONSTRAINT "EmployeePositionHistory_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeePositionHistory"
    ADD CONSTRAINT "EmployeePositionHistory_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeePositionHistory"
    ADD CONSTRAINT "EmployeePositionHistory_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeePositionHistory"
    ADD CONSTRAINT "EmployeePositionHistory_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeePositionHistory"
    ADD CONSTRAINT "EmployeePositionHistory_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeePositionHistory"
    ADD CONSTRAINT "EmployeePositionHistory_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
