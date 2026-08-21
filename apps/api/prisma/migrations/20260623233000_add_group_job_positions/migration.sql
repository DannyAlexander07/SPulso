-- Allow organization positions to be scoped either to a company or to the whole tenant group.
CREATE TYPE "JobPositionScope" AS ENUM ('COMPANY', 'GROUP');

ALTER TABLE "JobPosition"
ADD COLUMN "scope" "JobPositionScope" NOT NULL DEFAULT 'COMPANY';

ALTER TABLE "JobPosition"
DROP CONSTRAINT "JobPosition_companyId_fkey";

DROP INDEX IF EXISTS "JobPosition_companyId_slug_key";

ALTER TABLE "JobPosition"
ALTER COLUMN "companyId" DROP NOT NULL;

ALTER TABLE "JobPosition"
ADD CONSTRAINT "JobPosition_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "JobPosition_tenantId_scope_status_idx" ON "JobPosition"("tenantId", "scope", "status");
