-- CreateEnum
CREATE TYPE "AutomationRuleType" AS ENUM ('DOCUMENT_EXPIRING', 'DOCUMENT_EXPIRED', 'DOCUMENT_PENDING_SIGNATURE', 'REQUEST_PENDING', 'ATTENDANCE_LATE_REPEATED');

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "type" "AutomationRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdDays" INTEGER,
    "thresholdHours" INTEGER,
    "thresholdCount" INTEGER,
    "windowDays" INTEGER,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'WARNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_enabled_idx" ON "AutomationRule"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_companyId_enabled_idx" ON "AutomationRule"("companyId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_type_idx" ON "AutomationRule"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_tenantId_companyId_type_key" ON "AutomationRule"("tenantId", "companyId", "type");

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
