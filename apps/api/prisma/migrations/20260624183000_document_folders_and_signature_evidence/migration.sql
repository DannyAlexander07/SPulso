ALTER TABLE "EmployeeDocument"
  ADD COLUMN "folder" TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "signedByName" TEXT,
  ADD COLUMN "signedByEmail" TEXT,
  ADD COLUMN "signatureText" TEXT;

CREATE INDEX "EmployeeDocument_employeeId_folder_idx" ON "EmployeeDocument"("employeeId", "folder");
