import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import { assertImmediateExportLimit } from "@/lib/export-limits";
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeFilters,
  EmployeeProfile,
  EmployeeImportBatch,
  EmployeeImportRowData,
  EmployeesPageResult,
  TransferEmployeePayload,
  UpdateAttendancePinPayload,
  UpdateEmployeePayload,
} from "./types";

export async function downloadEmployeeImportTemplate() {
  const response = await fetch(
    `${getApiUrl()}/trabajadores/importaciones/plantilla`,
    {
      headers: clientAuthHeaders(),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo descargar la plantilla.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-trabajadores-spulso.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

export async function uploadEmployeeImport(companyId: string, file: File) {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("file", file);
  const response = await fetch(`${getApiUrl()}/trabajadores/importaciones`, {
    method: "POST",
    headers: clientAuthHeaders(),
    body: form,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo procesar el Excel.");
  }
  return response.json() as Promise<EmployeeImportBatch>;
}

export async function getEmployeeImportBatches() {
  const response = await fetch(`${getApiUrl()}/trabajadores/importaciones`, {
    cache: "no-store",
    headers: clientAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.message ?? "No se pudo cargar la bandeja de importaciones.",
    );
  }
  return response.json() as Promise<EmployeeImportBatch[]>;
}

export async function getEmployeeImportBatch(batchId: string) {
  const response = await fetch(
    `${getApiUrl()}/trabajadores/importaciones/${batchId}`,
    {
      cache: "no-store",
      headers: clientAuthHeaders(),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo abrir la importación.");
  }
  return response.json() as Promise<EmployeeImportBatch>;
}

export async function updateEmployeeImportRow(
  batchId: string,
  rowId: string,
  version: number,
  data: Partial<EmployeeImportRowData>,
  attendancePin: string,
) {
  const response = await fetch(
    `${getApiUrl()}/trabajadores/importaciones/${batchId}/filas/${rowId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...clientAuthHeaders() },
      body: JSON.stringify({ version, data, attendancePin }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo corregir la fila.");
  }
  return response.json() as Promise<EmployeeImportBatch>;
}

export async function retryEmployeeImport(batchId: string) {
  const response = await fetch(
    `${getApiUrl()}/trabajadores/importaciones/${batchId}/reintentar`,
    { method: "POST", headers: clientAuthHeaders() },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo reintentar la importación.");
  }
  return response.json() as Promise<EmployeeImportBatch>;
}

export async function skipEmployeeImportRow(batchId: string, rowId: string) {
  const response = await fetch(
    `${getApiUrl()}/trabajadores/importaciones/${batchId}/filas/${rowId}/omitir`,
    { method: "POST", headers: clientAuthHeaders() },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo omitir la fila.");
  }
  return response.json() as Promise<EmployeeImportBatch>;
}

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
  const response = await fetch(
    `${getApiUrl()}/trabajadores/${employeeId}/transferir`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...clientAuthHeaders(),
      },
      body: JSON.stringify(payload),
    },
  );

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
