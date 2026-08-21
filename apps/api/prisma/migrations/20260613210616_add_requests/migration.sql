-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('VACATION', 'PERMISSION', 'REMOTE_WORK', 'MEDICAL_LEAVE', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmployeeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeRequest_tenantId_status_idx" ON "EmployeeRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EmployeeRequest_companyId_status_idx" ON "EmployeeRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmployeeRequest_employeeId_idx" ON "EmployeeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRequest_startDate_idx" ON "EmployeeRequest"("startDate");

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
