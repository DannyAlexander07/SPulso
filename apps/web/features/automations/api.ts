import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type { AutomationRule, UpdateAutomationRulePayload } from "./types";

export function getAutomationRules(token?: string | null) {
  return apiGet<AutomationRule[]>("/automatizaciones", [], token);
}

export async function updateAutomationRule(ruleId: string, payload: UpdateAutomationRulePayload) {
  const response = await fetch(`${getApiUrl()}/automatizaciones/${ruleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar la automatizacion.");
  }

  return response.json() as Promise<AutomationRule>;
}
