CREATE TABLE "EmployeeCodeSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCodeSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeCodeSequence_companyId_key" ON "EmployeeCodeSequence"("companyId");

ALTER TABLE "EmployeeCodeSequence"
ADD CONSTRAINT "EmployeeCodeSequence_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
