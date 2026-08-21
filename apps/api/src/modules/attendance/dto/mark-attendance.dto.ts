import type { AttendanceStatus } from '@prisma/client';

export type MarkAttendanceDto = {
  employeeId: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
};
