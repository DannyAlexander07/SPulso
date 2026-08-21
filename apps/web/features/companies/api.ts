import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type {
  Company,
  CompanyFilters,
  CompanyProfile,
  CreateCompanyPayload,
  UpdateAttendanceRulesPayload,
  UpdateCompanyPayload,
} from "./types";

export function getCompanies(filters?: CompanyFilters, token?: string | null) {
  const query = new URLSearchParams();

  if (filters?.search) {
    query.set("search", filters.search);
  }

  if (filters?.status) {
    query.set("status", filters.status);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<Company[]>(`/empresas${suffix}`, [], token);
}

export function getCompanyProfile(companyId: string, token?: string | null) {
  return apiGet<CompanyProfile | null>(`/empresas/${companyId}/perfil`, null, token);
}

export async function createCompany(payload: CreateCompanyPayload) {
  const response = await fetch(`${getApiUrl()}/empresas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear la empresa.");
  }

  return response.json() as Promise<Company>;
}

export async function updateAttendanceRules(
  companyId: string,
  payload: UpdateAttendanceRulesPayload,
) {
  const response = await fetch(`${getApiUrl()}/empresas/${companyId}/reglas-asistencia`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar la regla de asistencia.");
  }

  return response.json() as Promise<Company>;
}

export async function updateCompany(companyId: string, payload: UpdateCompanyPayload) {
  const response = await fetch(`${getApiUrl()}/empresas/${companyId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar la empresa.");
  }

  return response.json() as Promise<Company>;
}
