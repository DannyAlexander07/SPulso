import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type { AttendanceRecord, AttendanceSummary, MarkAttendancePayload } from "./types";

const fallbackSummary: AttendanceSummary = {
  date: new Date().toISOString(),
  totalEmployees: 0,
  present: 0,
  late: 0,
  absent: 0,
  onLeave: 0,
  attendanceRate: 0,
};

export function getAttendanceSummary(date?: string, token?: string | null) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  return apiGet<AttendanceSummary>(`/asistencia/resumen${query}`, fallbackSummary, token);
}

export function getTodayAttendance(date?: string, token?: string | null) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  return apiGet<AttendanceRecord[]>(`/asistencia/hoy${query}`, [], token);
}

export function getAttendanceRange(from: string, to: string, token?: string | null) {
  const query = new URLSearchParams({
    from,
    to,
  });

  return apiGet<AttendanceRecord[]>(`/asistencia/rango?${query.toString()}`, [], token);
}

export async function markAttendance(payload: MarkAttendancePayload) {
  const response = await fetch(`${getApiUrl()}/asistencia/marcar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo registrar la asistencia.");
  }

  return response.json() as Promise<AttendanceRecord>;
}
