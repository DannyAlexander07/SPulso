export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string | null;
  employeeCode: string | null;
  areaId: string | null;
  positionId: string | null;
  teamId: string | null;
  managerId: string | null;
  jobTitle: string | null;
  area: string | null;
  hireDate: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
  company: {
    id: string;
    name: string;
    slug: string;
  };
  areaRef: {
    id: string;
    name: string;
    slug: string;
  } | null;
  position: {
    id: string;
    name: string;
    slug: string;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    leader: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    } | null;
  } | null;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  } | null;
  user: {
    id: string;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type EmployeeFilters = {
  companyId?: string;
  cursor?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: Employee["status"];
};

export type EmployeesPagination = {
  page: number;
  pageSize: number;
  total: number | null;
  totalPages: number | null;
  nextCursor: string | null;
  hasNextPage: boolean;
  mode?: "cursor" | "offset";
};

export type EmployeesPageResult = {
  data: Employee[];
  meta: EmployeesPagination;
};

export type CreateEmployeePayload = {
  companyId: string;
  areaId?: string | null;
  positionId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  firstName: string;
  lastName: string;
  documentNumber?: string;
  employeeCode?: string;
  attendancePin?: string;
  jobTitle?: string;
  area?: string;
  hireDate?: string;
};

export type UpdateEmployeePayload = {
  companyId?: string;
  areaId?: string | null;
  positionId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  firstName?: string;
  lastName?: string;
  documentNumber?: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  area?: string | null;
  hireDate?: string | null;
  terminatedAt?: string | null;
  terminationReason?: string | null;
  status?: Employee["status"];
};

export type TransferEmployeePayload = {
  areaId?: string | null;
  clientId?: string | null;
  companyId: string;
  effectiveDate?: string | null;
  isPrimaryClientAssignment?: boolean;
  managerId?: string | null;
  positionId?: string | null;
  reason?: string | null;
  role?: string | null;
  teamId?: string | null;
};

export type UpdateAttendancePinPayload = {
  attendancePin: string;
};

export type EmployeeProfile = {
  employee: Employee;
  timelineEvents: Array<{
    id: string;
    type:
      | "HIRED"
      | "REHIRED"
      | "TERMINATED"
      | "PROMOTED"
      | "TRANSFERRED"
      | "MANAGER_CHANGED"
      | "TEAM_CHANGED"
      | "PROFILE_UPDATED";
    title: string;
    description: string | null;
    effectiveDate: string | null;
    previousData: Record<string, unknown> | null;
    newData: Record<string, unknown> | null;
    createdBy: string | null;
    createdAt: string;
    company: Employee["company"] | null;
    area: {
      id: string;
      name: string;
      slug: string;
    } | null;
    position: {
      id: string;
      name: string;
      slug: string;
    } | null;
    team: {
      id: string;
      name: string;
      slug: string;
    } | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    } | null;
  }>;
  attendanceSummary: {
    absent: number;
    late: number;
    onLeave: number;
    present: number;
    total: number;
  };
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
    company: Employee["company"];
  }>;
  documents: Array<{
    id: string;
    type: "CONTRACT" | "PAYSLIP" | "POLICY" | "CERTIFICATE" | "OTHER";
    status: "DRAFT" | "PENDING_SIGNATURE" | "SIGNED" | "EXPIRED";
    title: string;
    folder: string;
    fileUrl: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    signedAt: string | null;
    signedByName: string | null;
    signedByEmail: string | null;
    signatureText: string | null;
    createdAt: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    };
    company: Employee["company"];
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
    company: Employee["company"];
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
    company: Employee["company"] | null;
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
    company: Employee["company"] | null;
  }>;
};
