-- Persist every accepted workbook before importing rows so interrupted browsers can resume.
CREATE TYPE "EmployeeImportBatchStatus" AS ENUM ('PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED');
CREATE TYPE "EmployeeImportRowStatus" AS ENUM ('PENDING', 'IMPORTED', 'FAILED', 'SKIPPED');

-- Persistent authentication lockout survives restarts and multiple API replicas.
ALTER TABLE "User"
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loginLockedUntil" TIMESTAMP(3),
ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);

ALTER TABLE "AttendanceRecord"
ADD COLUMN "checkInConsentAt" TIMESTAMP(3),
ADD COLUMN "checkOutConsentAt" TIMESTAMP(3),
ADD COLUMN "checkInPrivacyNoticeVersion" TEXT,
ADD COLUMN "checkOutPrivacyNoticeVersion" TEXT;

ALTER TYPE "EmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'SENT';

UPDATE "Employee"
SET "personalEmail" = LOWER(BTRIM("personalEmail"))
WHERE "personalEmail" IS NOT NULL;

CREATE UNIQUE INDEX "Employee_tenantId_personalEmail_key"
ON "Employee"("tenantId", "personalEmail");
CREATE UNIQUE INDEX "Employee_tenantId_documentNumber_key"
ON "Employee"("tenantId", "documentNumber");

CREATE TABLE "EmployeeImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "EmployeeImportBatchStatus" NOT NULL DEFAULT 'PROCESSING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "pendingRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "employeeId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "status" "EmployeeImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "errors" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeImportBatch_tenantId_companyId_fileHash_key"
ON "EmployeeImportBatch"("tenantId", "companyId", "fileHash");
CREATE INDEX "EmployeeImportBatch_tenantId_createdAt_idx"
ON "EmployeeImportBatch"("tenantId", "createdAt");
CREATE INDEX "EmployeeImportBatch_companyId_createdAt_idx"
ON "EmployeeImportBatch"("companyId", "createdAt");
CREATE INDEX "EmployeeImportBatch_createdByUserId_createdAt_idx"
ON "EmployeeImportBatch"("createdByUserId", "createdAt");
CREATE INDEX "EmployeeImportBatch_tenantId_status_updatedAt_idx"
ON "EmployeeImportBatch"("tenantId", "status", "updatedAt");

CREATE UNIQUE INDEX "EmployeeImportRow_batchId_rowNumber_key"
ON "EmployeeImportRow"("batchId", "rowNumber");
CREATE INDEX "EmployeeImportRow_batchId_status_rowNumber_idx"
ON "EmployeeImportRow"("batchId", "status", "rowNumber");
CREATE INDEX "EmployeeImportRow_employeeId_idx"
ON "EmployeeImportRow"("employeeId");

ALTER TABLE "EmployeeImportBatch"
ADD CONSTRAINT "EmployeeImportBatch_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeImportBatch"
ADD CONSTRAINT "EmployeeImportBatch_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeImportBatch"
ADD CONSTRAINT "EmployeeImportBatch_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeImportRow"
ADD CONSTRAINT "EmployeeImportRow_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "EmployeeImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeImportRow"
ADD CONSTRAINT "EmployeeImportRow_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
