import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import { assertImmediateExportLimit } from "@/lib/export-limits";
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeFilters,
  EmployeeProfile,
  EmployeesPageResult,
  TransferEmployeePayload,
  UpdateAttendancePinPayload,
  UpdateEmployeePayload,
} from "./types";

export function getEmployees(filters?: EmployeeFilters, token?: string | null) {
  return getEmployeesPage({ pageSize: 100, ...filters }, token).then(
    (result) => result.data,
  );
}

export function getEmployeesPage(
  filters?: EmployeeFilters,
  token?: string | null,
) {
  const query = buildEmployeesQuery(filters);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<EmployeesPageResult>(
    `/trabajadores${suffix}`,
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

export function getEmployeeProfile(employeeId: string, token?: string | null) {
  return apiGet<EmployeeProfile | null>(
    `/trabajadores/${employeeId}/perfil`,
    null,
    token,
  );
}

export async function getEmployeesForExport(filters: EmployeeFilters) {
  const pageSize = 100;
  let cursor: string | undefined;
  let hasNextPage = true;
  const employees: Employee[] = [];

  do {
    const query = buildEmployeesQuery({
      ...filters,
      cursor,
      pageSize,
    });
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const response = await fetch(`${getApiUrl()}/trabajadores${suffix}`, {
      headers: clientAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message ?? "No se pudo preparar el archivo.");
    }

    const result = (await response.json()) as EmployeesPageResult;

    employees.push(...result.data);
    assertImmediateExportLimit(employees.length);
    cursor = result.meta.nextCursor ?? undefined;
    hasNextPage = result.meta.hasNextPage && Boolean(cursor);
  } while (hasNextPage);

  return employees;
}

export async function createEmployee(payload: CreateEmployeePayload) {
  const response = await fetch(`${getApiUrl()}/trabajadores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear el trabajador.");
  }

  return response.json() as Promise<Employee>;
}

export async function getSuggestedEmployeeCode(companyId: string) {
  const response = await fetch(
    `${getApiUrl()}/trabajadores/codigo-sugerido?companyId=${encodeURIComponent(companyId)}`,
    {
      headers: clientAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo calcular el codigo interno.");
  }

  return response.json() as Promise<{
    code: string;
    nextNumber: number;
    prefix: string;
  }>;
}

export async function updateAttendancePin(
  employeeId: string,
  payload: UpdateAttendancePinPayload,
) {
  const response = await fetch(
    `${getApiUrl()}/trabajadores/${employeeId}/pin-marcacion`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...clientAuthHeaders(),
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar el PIN.");
  }

  return response.json() as Promise<Employee>;
}

export async function updateEmployee(
  employeeId: string,
  payload: UpdateEmployeePayload,
) {
  const response = await fetch(`${getApiUrl()}/trabajadores/${employeeId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar el trabajador.");
  }

  return response.json() as Promise<Employee>;
}

export async function transferEmployee(
  employeeId: string,
  payload: TransferEmployeePayload,
) {
  const response = await fetch(`${getApiUrl()}/trabajadores/${employeeId}/transferir`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo transferir al trabajador.");
  }

  return response.json() as Promise<Employee>;
}

export async function deleteEmployee(employeeId: string) {
  const response = await fetch(`${getApiUrl()}/trabajadores/${employeeId}`, {
    method: "DELETE",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo eliminar la ficha laboral.");
  }

  return response.json() as Promise<{ deleted: boolean; id: string }>;
}

function buildEmployeesQuery(filters?: EmployeeFilters) {
  const query = new URLSearchParams();

  if (filters?.search) {
    query.set("search", filters.search);
  }

  if (filters?.companyId) {
    query.set("companyId", filters.companyId);
  }

  if (filters?.status) {
    query.set("status", filters.status);
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
