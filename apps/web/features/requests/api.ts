import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import { assertImmediateExportLimit } from "@/lib/export-limits";
import type {
  CreateRequestPayload,
  EmployeeRequest,
  RequestFilters,
  RequestsPageResult,
  RequestsSummary,
} from "./types";

const fallbackSummary: RequestsSummary = {
  pending: 0,
  approved: 0,
  rejected: 0,
  cancelled: 0,
  total: 0,
};

export function getRequests(filters?: RequestFilters, token?: string | null) {
  return getRequestsPage({ pageSize: 100, ...filters }, token).then(
    (result) => result.data,
  );
}

export function getRequestsPage(
  filters?: RequestFilters,
  token?: string | null,
) {
  const query = buildRequestsQuery(filters);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<RequestsPageResult>(
    `/solicitudes${suffix}`,
    {
      data: [],
      meta: {
        page: filters?.page ?? 1,
        pageSize: filters?.pageSize ?? 10,
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

export async function getRequestsForExport(filters: RequestFilters) {
  const pageSize = 100;
  let cursor: string | undefined;
  let hasNextPage = true;
  const requests: EmployeeRequest[] = [];

  do {
    const query = buildRequestsQuery({
      ...filters,
      cursor,
      pageSize,
    });
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const response = await fetch(`${getApiUrl()}/solicitudes${suffix}`, {
      headers: clientAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message ?? "No se pudo preparar el archivo.");
    }

    const result = (await response.json()) as RequestsPageResult;

    requests.push(...result.data);
    assertImmediateExportLimit(requests.length);
    cursor = result.meta.nextCursor ?? undefined;
    hasNextPage = result.meta.hasNextPage && Boolean(cursor);
  } while (hasNextPage);

  return requests;
}

function buildRequestsQuery(filters?: RequestFilters) {
  const query = new URLSearchParams();

  if (filters?.search) {
    query.set("search", filters.search);
  }

  if (filters?.companyId) {
    query.set("companyId", filters.companyId);
  }

  if (filters?.employeeId) {
    query.set("employeeId", filters.employeeId);
  }

  if (filters?.status) {
    query.set("status", filters.status);
  }

  if (filters?.type) {
    query.set("type", filters.type);
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

  return query;
}

export function getRequestsSummary(token?: string | null) {
  return apiGet<RequestsSummary>(
    "/solicitudes/resumen",
    fallbackSummary,
    token,
  );
}

export async function createRequest(payload: CreateRequestPayload) {
  const response = await fetch(`${getApiUrl()}/solicitudes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear la solicitud.");
  }

  return response.json() as Promise<EmployeeRequest>;
}

export async function approveRequest(id: string) {
  return decideRequest(id, "aprobar");
}

export async function rejectRequest(id: string) {
  return decideRequest(id, "rechazar");
}

async function decideRequest(id: string, action: "aprobar" | "rechazar") {
  const response = await fetch(`${getApiUrl()}/solicitudes/${id}/${action}`, {
    method: "PATCH",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar la solicitud.");
  }

  return response.json() as Promise<EmployeeRequest>;
}
