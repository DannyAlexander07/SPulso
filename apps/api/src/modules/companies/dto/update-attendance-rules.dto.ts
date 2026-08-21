export type UpdateAttendanceRulesDto = {
  workStartTime: string;
  lateToleranceMinutes: number;
  enforceAttendanceGeofence?: boolean;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
  attendanceRadiusMeters?: number;
};
