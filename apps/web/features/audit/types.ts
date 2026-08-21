export type AuditLog = {
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
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type AuditFilters = {
  actorType?: string;
  companyId?: string;
  cursor?: string;
  from?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  to?: string;
};

export type AuditPagination = {
  page: number;
  pageSize: number;
  total: number | null;
  totalPages: number | null;
  nextCursor: string | null;
  hasNextPage: boolean;
  mode?: "cursor" | "offset";
};

export type AuditPageResult = {
  data: AuditLog[];
  meta: AuditPagination;
};
