import { API_URL } from "@/lib/api";
import type { AttendanceRecord } from "@/features/attendance/types";

export async function selfMarkAttendance(payload: {
  tenantSlug?: string;
  companySlug: string;
  identifier: string;
  pin: string;
  action: "CHECK_IN" | "CHECK_OUT";
  latitude?: number;
  longitude?: number;
  locationConsent: boolean;
  privacyNoticeVersion: "gps-2026-08-29";
}) {
  const response = await fetch(`${API_URL}/asistencia/marcacion-personal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo registrar la marcacion.");
  }

  return response.json() as Promise<AttendanceRecord>;
}
