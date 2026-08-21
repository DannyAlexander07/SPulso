import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type {
  Area,
  AssignmentPayload,
  Client,
  EmployeeClientAssignment,
  JobPosition,
  OrganizationData,
  OrganizationPayload,
  StructuralImpact,
  WorkTeam,
} from "./types";

export class OrganizationApiError extends Error {
  status: number;
  impact: StructuralImpact | null;

  constructor(message: string, status: number, impact: StructuralImpact | null = null) {
    super(message);
    this.name = "OrganizationApiError";
    this.status = status;
    this.impact = impact;
  }
}

export function getOrganization(companyId?: string, token?: string | null) {
  const query = new URLSearchParams();

  if (companyId) {
    query.set("companyId", companyId);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<OrganizationData>(
    `/organizacion${suffix}`,
    {
      areas: [],
      clients: [],
      assignments: [],
      positions: [],
      teams: [],
      employees: [],
      summary: { areas: 0, assignments: 0, clients: 0, employees: 0, positions: 0, teams: 0 },
    },
    token,
  );
}

export function createArea(payload: OrganizationPayload) {
  return send<Area>("/organizacion/areas", "POST", payload);
}

export function updateArea(id: string, payload: Partial<OrganizationPayload>) {
  return send<Area>(`/organizacion/areas/${id}`, "PATCH", payload);
}

export function createClient(payload: OrganizationPayload) {
  return send<Client>("/organizacion/clientes", "POST", payload);
}

export function updateClient(id: string, payload: Partial<OrganizationPayload>) {
  return send<Client>(`/organizacion/clientes/${id}`, "PATCH", payload);
}

export function createJobPosition(payload: OrganizationPayload) {
  return send<JobPosition>("/organizacion/cargos", "POST", payload);
}

export function updateJobPosition(id: string, payload: Partial<OrganizationPayload>) {
  return send<JobPosition>(`/organizacion/cargos/${id}`, "PATCH", payload);
}

export function createWorkTeam(payload: OrganizationPayload) {
  return send<WorkTeam>("/organizacion/equipos", "POST", payload);
}

export function updateWorkTeam(id: string, payload: Partial<OrganizationPayload>) {
  return send<WorkTeam>(`/organizacion/equipos/${id}`, "PATCH", payload);
}

export function updateWorkTeamMembers(
  id: string,
  payload: { leaderEmployeeId?: string; employeeIds: string[] },
) {
  return send<WorkTeam>(`/organizacion/equipos/${id}/miembros`, "PATCH", payload);
}

export function createAssignment(payload: AssignmentPayload) {
  return send<EmployeeClientAssignment>("/organizacion/asignaciones", "POST", payload);
}

export function updateAssignment(id: string, payload: Partial<AssignmentPayload>) {
  return send<EmployeeClientAssignment>(`/organizacion/asignaciones/${id}`, "PATCH", payload);
}

async function send<T>(path: string, method: "PATCH" | "POST", payload: unknown) {
  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const impact = parseStructuralImpact(error);
    throw new OrganizationApiError(
      impact?.message ?? normalizeErrorMessage(error) ?? "No se pudo guardar la estructura.",
      response.status,
      impact,
    );
  }

  return response.json() as Promise<T>;
}

function normalizeErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const message = (error as { message?: unknown }).message;

  if (typeof message === "string") {
    return message;
  }

  if (message && typeof message === "object") {
    const nestedMessage = (message as { message?: unknown }).message;
    return typeof nestedMessage === "string" ? nestedMessage : null;
  }

  return null;
}

function parseStructuralImpact(error: unknown): StructuralImpact | null {
  const payload = unwrapErrorPayload(error);

  if (!payload || payload.code !== "STRUCTURAL_IMPACT") {
    return null;
  }

  const impacts = Array.isArray(payload.impacts)
    ? payload.impacts
        .map((impact) => ({
          count: Number((impact as { count?: unknown }).count ?? 0),
          label: String((impact as { label?: unknown }).label ?? ""),
        }))
        .filter((impact) => impact.label && impact.count > 0)
    : [];

  return {
    actions: Array.isArray(payload.actions) ? payload.actions.map(String) : [],
    code: "STRUCTURAL_IMPACT",
    impacts,
    message: String(payload.message ?? "El cambio tiene informacion relacionada."),
    recommendation: String(payload.recommendation ?? "Revisa el impacto antes de continuar."),
    title: String(payload.title ?? "Cambio protegido por historial"),
  };
}

function unwrapErrorPayload(error: unknown): Partial<StructuralImpact> | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const direct = error as Partial<StructuralImpact> & { message?: unknown };

  if (direct.code === "STRUCTURAL_IMPACT") {
    return direct;
  }

  if (direct.message && typeof direct.message === "object") {
    const nested = direct.message as Partial<StructuralImpact>;
    return nested.code === "STRUCTURAL_IMPACT" ? nested : null;
  }

  return null;
}
