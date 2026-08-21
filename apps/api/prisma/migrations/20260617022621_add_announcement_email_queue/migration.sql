-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ANNOUNCEMENT_PUBLISHED';

-- CreateTable
CREATE TABLE "AnnouncementEmailDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementEmailDelivery_tenantId_status_idx" ON "AnnouncementEmailDelivery"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AnnouncementEmailDelivery_announcementId_idx" ON "AnnouncementEmailDelivery"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementEmailDelivery_employeeId_idx" ON "AnnouncementEmailDelivery"("employeeId");

-- CreateIndex
CREATE INDEX "AnnouncementEmailDelivery_queuedAt_idx" ON "AnnouncementEmailDelivery"("queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementEmailDelivery_announcementId_employeeId_key" ON "AnnouncementEmailDelivery"("announcementId", "employeeId");

-- AddForeignKey
ALTER TABLE "AnnouncementEmailDelivery" ADD CONSTRAINT "AnnouncementEmailDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementEmailDelivery" ADD CONSTRAINT "AnnouncementEmailDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementEmailDelivery" ADD CONSTRAINT "AnnouncementEmailDelivery_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
