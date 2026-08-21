ALTER TABLE "WorkTeam" ADD COLUMN "clientId" TEXT;

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ruc" TEXT,
  "description" TEXT,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeClientAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "areaId" TEXT,
  "teamId" TEXT,
  "role" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeClientAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_companyId_slug_key" ON "Client"("companyId", "slug");
CREATE INDEX "Client_tenantId_status_idx" ON "Client"("tenantId", "status");
CREATE INDEX "Client_companyId_status_idx" ON "Client"("companyId", "status");
CREATE INDEX "WorkTeam_clientId_idx" ON "WorkTeam"("clientId");
CREATE INDEX "EmployeeClientAssignment_tenantId_status_idx" ON "EmployeeClientAssignment"("tenantId", "status");
CREATE INDEX "EmployeeClientAssignment_companyId_status_idx" ON "EmployeeClientAssignment"("companyId", "status");
CREATE INDEX "EmployeeClientAssignment_employeeId_status_idx" ON "EmployeeClientAssignment"("employeeId", "status");
CREATE INDEX "EmployeeClientAssignment_clientId_status_idx" ON "EmployeeClientAssignment"("clientId", "status");
CREATE INDEX "EmployeeClientAssignment_areaId_idx" ON "EmployeeClientAssignment"("areaId");
CREATE INDEX "EmployeeClientAssignment_teamId_idx" ON "EmployeeClientAssignment"("teamId");

ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkTeam" ADD CONSTRAINT "WorkTeam_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeClientAssignment" ADD CONSTRAINT "EmployeeClientAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeClientAssignment" ADD CONSTRAINT "EmployeeClientAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeClientAssignment" ADD CONSTRAINT "EmployeeClientAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeClientAssignment" ADD CONSTRAINT "EmployeeClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeClientAssignment" ADD CONSTRAINT "EmployeeClientAssignment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeClientAssignment" ADD CONSTRAINT "EmployeeClientAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorkTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
