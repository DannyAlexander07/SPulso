import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

const DUMMY_PIN_HASH = bcrypt.hashSync('spulso-invalid-pin-dummy', 10);
const PIN_LOCK_MINUTES = 15;
const PIN_MAX_FAILED_ATTEMPTS = 10;

type PinRow = {
  attendancePinFailedAttempts: number;
  attendancePinHash: string | null;
  attendancePinLockedUntil: Date | null;
};

export function performDummyPinComparison(pin: string) {
  return bcrypt.compare(pin, DUMMY_PIN_HASH);
}

export async function verifyAttendancePinAtomically(
  prisma: PrismaService,
  employeeId: string,
  pin: string,
  replacementHash?: string,
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<PinRow[]>(Prisma.sql`
      SELECT
        "attendancePinHash",
        "attendancePinFailedAttempts",
        "attendancePinLockedUntil"
      FROM "Employee"
      WHERE "id" = ${employeeId}
      FOR UPDATE
    `);
    const employee = rows[0];
    if (!employee) {
      await performDummyPinComparison(pin);
      return false;
    }

    const hash = employee.attendancePinHash ?? DUMMY_PIN_HASH;
    const matches = await bcrypt.compare(pin, hash);
    if (
      employee.attendancePinLockedUntil &&
      employee.attendancePinLockedUntil.getTime() > Date.now()
    ) {
      return false;
    }

    if (!employee.attendancePinHash || !matches) {
      const failedAttempts = employee.attendancePinFailedAttempts + 1;
      await tx.employee.update({
        where: { id: employeeId },
        data:
          failedAttempts >= PIN_MAX_FAILED_ATTEMPTS
            ? {
                attendancePinFailedAttempts: 0,
                attendancePinLockedUntil: new Date(
                  Date.now() + PIN_LOCK_MINUTES * 60 * 1000,
                ),
              }
            : { attendancePinFailedAttempts: failedAttempts },
        select: { id: true },
      });
      return false;
    }

    await tx.employee.update({
      where: { id: employeeId },
      data: {
        ...(replacementHash
          ? {
              attendancePinHash: replacementHash,
              attendancePinChangeRequired: false,
            }
          : {}),
        attendancePinFailedAttempts: 0,
        attendancePinLockedUntil: null,
      },
      select: { id: true },
    });
    return true;
  });
}
