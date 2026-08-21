import type { CompanyStatus } from '@prisma/client';

export type UpdateCompanyDto = {
  name?: string;
  slug?: string;
  ruc?: string | null;
  workStartTime?: string;
  lateToleranceMinutes?: number;
  enforceAttendanceGeofence?: boolean;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
  attendanceRadiusMeters?: number;
  status?: CompanyStatus;
};
