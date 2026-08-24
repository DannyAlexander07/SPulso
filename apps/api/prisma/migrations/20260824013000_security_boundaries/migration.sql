ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Employee"
ADD COLUMN "attendancePinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "attendancePinLockedUntil" TIMESTAMP(3);

ALTER TABLE "EmployeeDocument"
ADD COLUMN "signedContentHash" TEXT;

-- Existing users must receive the hardened built-in authorization presets too.
UPDATE "Role"
SET "permissions" = ARRAY['attendance.mark']::TEXT[]
WHERE "name" = 'Trabajador';

UPDATE "Role"
SET "permissions" = array_append("permissions", 'documents.export')
WHERE "name" IN (
  'Super Admin',
  'Admin Grupo',
  'RRHH',
  'Gerencia',
  'Jefe de Area'
)
AND NOT ('documents.export' = ANY("permissions"));

-- Legacy four-digit PINs remain bcrypt-valid, so require every existing holder
-- to choose a PIN that satisfies the new policy before the next attendance mark.
UPDATE "Employee"
SET "attendancePinChangeRequired" = true
WHERE "attendancePinHash" IS NOT NULL;
