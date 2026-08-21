export type AttendanceSummary = {
  date: string;
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  attendanceRate: number;
};

export type AttendanceRecord = {
  id: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE";
  source: string;
  notes: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

export type AttendanceRecordFilters = {
  companyId?: string;
  search?: string;
  status?: AttendanceRecord["status"];
};

export type MarkAttendancePayload = {
  employeeId: string;
  status: AttendanceRecord["status"];
  checkIn?: string;
  checkOut?: string;
  notes?: string;
};
