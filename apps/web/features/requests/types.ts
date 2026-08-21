export type EmployeeRequest = {
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
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

export type RequestsSummary = {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  total: number;
};

export type RequestFilters = {
  companyId?: string;
  cursor?: string;
  employeeId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: EmployeeRequest["status"];
  type?: EmployeeRequest["type"];
};

export type RequestsPagination = {
  page: number;
  pageSize: number;
  total: number | null;
  totalPages: number | null;
  nextCursor: string | null;
  hasNextPage: boolean;
  mode?: "cursor" | "offset";
};

export type RequestsPageResult = {
  data: EmployeeRequest[];
  meta: RequestsPagination;
};

export type CreateRequestPayload = {
  employeeId: string;
  type: EmployeeRequest["type"];
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
};
