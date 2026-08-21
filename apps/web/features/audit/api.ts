import { apiGet } from "@/lib/api";
import type { AuditFilters, AuditPageResult } from "./types";

export function getAuditLogs(filters?: AuditFilters, token?: string | null) {
  return getAuditLogsPage({ pageSize: 100, ...filters }, token).then(
    (result) => result.data,
  );
}

export function getAuditLogsPage(
  filters?: AuditFilters,
  token?: string | null,
) {
  const query = new URLSearchParams();

  if (filters?.search) {
    query.set("search", filters.search);
  }

  if (filters?.actorType) {
    query.set("actorType", filters.actorType);
  }

  if (filters?.companyId) {
    query.set("companyId", filters.companyId);
  }

  if (filters?.from) {
    query.set("from", filters.from);
  }

  if (filters?.to) {
    query.set("to", filters.to);
  }

  if (filters?.page) {
    query.set("page", String(filters.page));
  }

  if (filters?.cursor) {
    query.set("cursor", filters.cursor);
  }

  if (filters?.pageSize) {
    query.set("pageSize", String(filters.pageSize));
  }

  query.set("pagination", "cursor");

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<AuditPageResult>(
    `/auditoria${suffix}`,
    {
      data: [],
      meta: {
        page: filters?.page ?? 1,
        pageSize: filters?.pageSize ?? 20,
        total: null,
        totalPages: null,
        nextCursor: null,
        hasNextPage: false,
        mode: "cursor",
      },
    },
    token,
  );
}
