-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementAudienceScope" AS ENUM ('ALL', 'COMPANIES', 'TEAMS');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "audienceScope" "AnnouncementAudienceScope" NOT NULL DEFAULT 'ALL',
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementAudience" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "companyId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_tenantId_status_idx" ON "Announcement"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Announcement_tenantId_audienceScope_idx" ON "Announcement"("tenantId", "audienceScope");

-- CreateIndex
CREATE INDEX "Announcement_priority_idx" ON "Announcement"("priority");

-- CreateIndex
CREATE INDEX "Announcement_publishAt_idx" ON "Announcement"("publishAt");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "AnnouncementAudience_tenantId_idx" ON "AnnouncementAudience"("tenantId");

-- CreateIndex
CREATE INDEX "AnnouncementAudience_announcementId_idx" ON "AnnouncementAudience"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementAudience_companyId_idx" ON "AnnouncementAudience"("companyId");

-- CreateIndex
CREATE INDEX "AnnouncementAudience_teamId_idx" ON "AnnouncementAudience"("teamId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAudience" ADD CONSTRAINT "AnnouncementAudience_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAudience" ADD CONSTRAINT "AnnouncementAudience_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAudience" ADD CONSTRAINT "AnnouncementAudience_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAudience" ADD CONSTRAINT "AnnouncementAudience_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorkTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
