ALTER TABLE "Employee"
ADD COLUMN "attendancePinChangeRequired" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Company"
ADD COLUMN "enforceAttendanceGeofence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "officeLatitude" DOUBLE PRECISION,
ADD COLUMN "officeLongitude" DOUBLE PRECISION,
ADD COLUMN "attendanceRadiusMeters" INTEGER NOT NULL DEFAULT 200;

UPDATE "Role"
SET "permissions" = array_append("permissions", 'exports.manage')
WHERE "name" IN ('Super Admin', 'Admin Grupo', 'RRHH', 'Gerencia', 'Jefe de Area')
  AND NOT ('exports.manage' = ANY("permissions"));
