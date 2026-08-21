-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "workStartTime" TEXT NOT NULL DEFAULT '09:00';
