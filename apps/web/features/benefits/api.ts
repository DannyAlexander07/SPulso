import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type { Benefit, BenefitPayload, BenefitsResult } from "./types";

const fallback: BenefitsResult = {
  data: [],
  summary: { active: 0, highlighted: 0, segmented: 0, total: 0 },
};

export function getBenefits(
  filters?: { companyId?: string; scope?: string; search?: string; status?: string },
  token?: string | null,
) {
  const query = new URLSearchParams();

  if (filters?.companyId) query.set("companyId", filters.companyId);
  if (filters?.scope) query.set("scope", filters.scope);
  if (filters?.search) query.set("search", filters.search);
  if (filters?.status) query.set("status", filters.status);

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<BenefitsResult>(`/beneficios${suffix}`, fallback, token);
}

export function createBenefit(payload: BenefitPayload) {
  return send<Benefit>("/beneficios", "POST", payload);
}

export function updateBenefit(id: string, payload: Partial<BenefitPayload>) {
  return send<Benefit>(`/beneficios/${id}`, "PATCH", payload);
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
    throw new Error(error?.message ?? "No se pudo guardar el beneficio.");
  }

  return response.json() as Promise<T>;
}
