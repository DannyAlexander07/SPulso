-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "attendancePinHash" TEXT;

UPDATE "Employee"
SET "attendancePinHash" = '$2b$10$ds0zg4OUv/UJJ0fmYohMl.gFlSSym/f2g428TEtVBWfOYQx.AFQoK'
WHERE "attendancePinHash" IS NULL;
