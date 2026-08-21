import { API_URL } from "@/lib/api";

export async function selfUpdateAttendancePin(payload: {
  tenantSlug?: string;
  companySlug: string;
  identifier: string;
  currentPin: string;
  newPin: string;
}) {
  const response = await fetch(`${API_URL}/trabajadores/actualizar-pin-marcacion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar el PIN.");
  }

  return response.json() as Promise<{ status: string; message: string }>;
}
