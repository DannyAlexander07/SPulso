-- CreateEnum
CREATE TYPE "BenefitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BenefitAudienceScope" AS ENUM ('ALL', 'COMPANIES', 'TEAMS');

-- CreateTable
CREATE TABLE "Benefit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "BenefitStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceScope" "BenefitAudienceScope" NOT NULL DEFAULT 'ALL',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "imageUrl" TEXT,
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitAudience" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "companyId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenefitAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Benefit_tenantId_status_idx" ON "Benefit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Benefit_tenantId_audienceScope_idx" ON "Benefit"("tenantId", "audienceScope");

-- CreateIndex
CREATE INDEX "Benefit_startsAt_idx" ON "Benefit"("startsAt");

-- CreateIndex
CREATE INDEX "Benefit_endsAt_idx" ON "Benefit"("endsAt");

-- CreateIndex
CREATE INDEX "BenefitAudience_tenantId_idx" ON "BenefitAudience"("tenantId");

-- CreateIndex
CREATE INDEX "BenefitAudience_benefitId_idx" ON "BenefitAudience"("benefitId");

-- CreateIndex
CREATE INDEX "BenefitAudience_companyId_idx" ON "BenefitAudience"("companyId");

-- CreateIndex
CREATE INDEX "BenefitAudience_teamId_idx" ON "BenefitAudience"("teamId");

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitAudience" ADD CONSTRAINT "BenefitAudience_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitAudience" ADD CONSTRAINT "BenefitAudience_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "Benefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitAudience" ADD CONSTRAINT "BenefitAudience_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitAudience" ADD CONSTRAINT "BenefitAudience_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorkTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
