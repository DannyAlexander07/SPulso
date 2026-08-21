-- Add individual worker targeting for announcements.
ALTER TYPE "AnnouncementAudienceScope" ADD VALUE 'EMPLOYEES';

ALTER TABLE "AnnouncementAudience" ADD COLUMN "employeeId" TEXT;

CREATE INDEX "AnnouncementAudience_employeeId_idx" ON "AnnouncementAudience"("employeeId");

ALTER TABLE "AnnouncementAudience"
  ADD CONSTRAINT "AnnouncementAudience_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
