CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "DocumentFolder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "type" "DocumentType",
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "visibleToEmployee" BOOLEAN NOT NULL DEFAULT true,
  "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
  "allowMultiple" BOOLEAN NOT NULL DEFAULT true,
  "retentionYears" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentFolder_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);

ALTER TABLE "EmployeeDocument"
  ADD COLUMN "folderId" TEXT,
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "visibleToEmployee" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "signatureIp" TEXT,
  ADD COLUMN "signatureUserAgent" TEXT,
  ADD COLUMN "signatureHash" TEXT;

INSERT INTO "DocumentFolder" (
  "id",
  "tenantId",
  "companyId",
  "name",
  "slug",
  "type",
  "visibleToEmployee",
  "requiresSignature",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::TEXT,
  folders."tenantId",
  NULL,
  folders."folder",
  trim(both '-' from regexp_replace(lower(folders."folder"), '[^a-z0-9]+', '-', 'g')),
  CASE
    WHEN lower(folders."folder") LIKE '%boleta%' THEN 'PAYSLIP'::"DocumentType"
    WHEN lower(folders."folder") LIKE '%contrato%' THEN 'CONTRACT'::"DocumentType"
    WHEN lower(folders."folder") LIKE '%certificado%' THEN 'CERTIFICATE'::"DocumentType"
    WHEN lower(folders."folder") LIKE '%politica%' THEN 'POLICY'::"DocumentType"
    ELSE NULL
  END,
  true,
  CASE
    WHEN lower(folders."folder") LIKE '%contrato%' THEN true
    WHEN lower(folders."folder") LIKE '%adenda%' THEN true
    WHEN lower(folders."folder") LIKE '%sancion%' THEN true
    WHEN lower(folders."folder") LIKE '%suspension%' THEN true
    ELSE false
  END,
  folders."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    "tenantId",
    COALESCE(NULLIF(TRIM("folder"), ''), 'General') AS "folder",
    dense_rank() OVER (PARTITION BY "tenantId" ORDER BY COALESCE(NULLIF(TRIM("folder"), ''), 'General')) AS "sortOrder"
  FROM "EmployeeDocument"
) folders
ON CONFLICT ("tenantId", "slug") DO NOTHING;

INSERT INTO "DocumentFolder" (
  "id",
  "tenantId",
  "companyId",
  "name",
  "slug",
  "description",
  "type",
  "visibleToEmployee",
  "requiresSignature",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::TEXT,
  t."id",
  NULL,
  seed."name",
  seed."slug",
  seed."description",
  seed."type"::"DocumentType",
  seed."visibleToEmployee",
  seed."requiresSignature",
  seed."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (
  VALUES
    ('Boletas', 'boletas', 'Pagos mensuales y constancias remunerativas.', 'PAYSLIP', true, false, 10),
    ('Contratos', 'contratos', 'Contratos laborales y acuerdos principales.', 'CONTRACT', true, true, 20),
    ('Adendas', 'adendas', 'Cambios contractuales, anexos y renovaciones.', 'CONTRACT', true, true, 30),
    ('Suspensiones y sanciones', 'suspensiones-y-sanciones', 'Medidas disciplinarias, suspensiones y cartas de sancion.', 'OTHER', true, true, 40),
    ('Certificados', 'certificados', 'Certificados laborales y constancias.', 'CERTIFICATE', true, false, 50),
    ('Equipos y activos', 'equipos-y-activos', 'Entregas, devoluciones y responsabilidades de equipos.', 'OTHER', true, true, 60),
    ('Interno RRHH', 'interno-rrhh', 'Documentos privados visibles solo para RRHH.', 'OTHER', false, false, 70)
) AS seed("name", "slug", "description", "type", "visibleToEmployee", "requiresSignature", "sortOrder")
ON CONFLICT ("tenantId", "slug") DO NOTHING;

UPDATE "EmployeeDocument" doc
SET
  "folderId" = folder."id",
  "visibleToEmployee" = folder."visibleToEmployee",
  "requiresSignature" = CASE
    WHEN doc."status" = 'PENDING_SIGNATURE'::"DocumentStatus" THEN true
    ELSE folder."requiresSignature"
  END
FROM "DocumentFolder" folder
WHERE
  folder."tenantId" = doc."tenantId"
  AND folder."slug" = trim(both '-' from regexp_replace(lower(COALESCE(NULLIF(TRIM(doc."folder"), ''), 'General')), '[^a-z0-9]+', '-', 'g'));

CREATE INDEX "DocumentFolder_tenantId_status_idx" ON "DocumentFolder"("tenantId", "status");
CREATE INDEX "DocumentFolder_companyId_status_idx" ON "DocumentFolder"("companyId", "status");
CREATE INDEX "DocumentFolder_tenantId_sortOrder_name_idx" ON "DocumentFolder"("tenantId", "sortOrder", "name");

CREATE INDEX "EmployeeDocument_tenantId_folderId_idx" ON "EmployeeDocument"("tenantId", "folderId");
CREATE INDEX "EmployeeDocument_companyId_folderId_idx" ON "EmployeeDocument"("companyId", "folderId");
CREATE INDEX "EmployeeDocument_employeeId_folderId_idx" ON "EmployeeDocument"("employeeId", "folderId");

ALTER TABLE "DocumentFolder"
  ADD CONSTRAINT "DocumentFolder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentFolder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument"
  ADD CONSTRAINT "EmployeeDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
