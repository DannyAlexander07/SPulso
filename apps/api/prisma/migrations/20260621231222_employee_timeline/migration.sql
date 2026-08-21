-- CreateEnum
CREATE TYPE "EmployeeTimelineEventType" AS ENUM ('HIRED', 'REHIRED', 'TERMINATED', 'PROMOTED', 'TRANSFERRED', 'MANAGER_CHANGED', 'TEAM_CHANGED', 'PROFILE_UPDATED');

-- CreateTable
CREATE TABLE "EmployeeTimelineEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT,
    "areaId" TEXT,
    "positionId" TEXT,
    "teamId" TEXT,
    "managerId" TEXT,
    "type" "EmployeeTimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "previousData" JSONB,
    "newData" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeTimelineEvent_tenantId_idx" ON "EmployeeTimelineEvent"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeTimelineEvent_employeeId_createdAt_idx" ON "EmployeeTimelineEvent"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeTimelineEvent_companyId_idx" ON "EmployeeTimelineEvent"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeTimelineEvent_areaId_idx" ON "EmployeeTimelineEvent"("areaId");

-- CreateIndex
CREATE INDEX "EmployeeTimelineEvent_positionId_idx" ON "EmployeeTimelineEvent"("positionId");

-- CreateIndex
CREATE INDEX "EmployeeTimelineEvent_teamId_idx" ON "EmployeeTimelineEvent"("teamId");

-- CreateIndex
CREATE INDEX "EmployeeTimelineEvent_managerId_idx" ON "EmployeeTimelineEvent"("managerId");

-- AddForeignKey
ALTER TABLE "EmployeeTimelineEvent" ADD CONSTRAINT "EmployeeTimelineEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimelineEvent" ADD CONSTRAINT "EmployeeTimelineEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimelineEvent" ADD CONSTRAINT "EmployeeTimelineEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimelineEvent" ADD CONSTRAINT "EmployeeTimelineEvent_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimelineEvent" ADD CONSTRAINT "EmployeeTimelineEvent_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimelineEvent" ADD CONSTRAINT "EmployeeTimelineEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorkTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimelineEvent" ADD CONSTRAINT "EmployeeTimelineEvent_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
