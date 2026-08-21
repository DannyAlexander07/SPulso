export type Company = {
  id: string;
  name: string;
  slug: string;
  ruc: string | null;
  workStartTime: string;
  lateToleranceMinutes: number;
  enforceAttendanceGeofence: boolean;
  officeLatitude: number | null;
  officeLongitude: number | null;
  attendanceRadiusMeters: number;
  status: "ACTIVE" | "INACTIVE";
};

export type CompanyFilters = {
  search?: string;
  status?: Company["status"];
};

export type CreateCompanyPayload = {
  name: string;
  slug?: string;
  ruc?: string;
};

export type UpdateCompanyPayload = {
  name?: string;
  slug?: string;
  ruc?: string | null;
  workStartTime?: string;
  lateToleranceMinutes?: number;
  enforceAttendanceGeofence?: boolean;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
  attendanceRadiusMeters?: number;
  status?: Company["status"];
};

export type UpdateAttendanceRulesPayload = {
  workStartTime: string;
  lateToleranceMinutes: number;
  enforceAttendanceGeofence: boolean;
  officeLatitude: number | null;
  officeLongitude: number | null;
  attendanceRadiusMeters: number;
};

export type CompanyProfile = {
  company: Company;
  employeeSummary: {
    active: number;
    inactive: number;
    terminated: number;
    total: number;
  };
  attendanceSummary: {
    absent: number;
    late: number;
    onLeave: number;
    present: number;
    total: number;
  };
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    documentNumber: string | null;
    employeeCode: string | null;
    jobTitle: string | null;
    area: string | null;
    hireDate: string | null;
    status: "ACTIVE" | "INACTIVE" | "TERMINATED";
    company: Pick<Company, "id" | "name" | "slug">;
  }>;
  attendance: Array<{
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
    company: Pick<Company, "id" | "name" | "slug">;
  }>;
  documents: Array<{
    id: string;
    type: "CONTRACT" | "PAYSLIP" | "POLICY" | "CERTIFICATE" | "OTHER";
    status: "DRAFT" | "PENDING_SIGNATURE" | "SIGNED" | "EXPIRED";
    title: string;
    fileUrl: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    };
    company: Pick<Company, "id" | "name" | "slug">;
  }>;
  requests: Array<{
    id: string;
    type: "VACATION" | "PERMISSION" | "REMOTE_WORK" | "MEDICAL_LEAVE" | "OTHER";
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    title: string;
    description: string | null;
    startDate: string;
    endDate: string | null;
    createdAt: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    };
    company: Pick<Company, "id" | "name" | "slug">;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    priority: "INFO" | "WARNING" | "CRITICAL";
    status: "UNREAD" | "READ";
    title: string;
    message: string;
    actionHref: string | null;
    entityType: string | null;
    entityId: string | null;
    generatedAt: string;
    readAt: string | null;
    createdAt: string;
    company: Pick<Company, "id" | "name" | "slug"> | null;
  }>;
  auditLogs: Array<{
    id: string;
    actorType: string;
    actorLabel: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    createdAt: string;
    company: Pick<Company, "id" | "name" | "slug"> | null;
  }>;
};
