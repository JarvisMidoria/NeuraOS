CREATE TABLE "CompanyWorkspace" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "simulationCompanyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyWorkspace_companyId_key" ON "CompanyWorkspace"("companyId");
CREATE UNIQUE INDEX "CompanyWorkspace_simulationCompanyId_key" ON "CompanyWorkspace"("simulationCompanyId");
CREATE INDEX "CompanyWorkspace_companyId_idx" ON "CompanyWorkspace"("companyId");
CREATE INDEX "CompanyWorkspace_simulationCompanyId_idx" ON "CompanyWorkspace"("simulationCompanyId");

ALTER TABLE "CompanyWorkspace"
ADD CONSTRAINT "CompanyWorkspace_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyWorkspace"
ADD CONSTRAINT "CompanyWorkspace_simulationCompanyId_fkey"
FOREIGN KEY ("simulationCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
