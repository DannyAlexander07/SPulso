import { getAttendanceRange } from "@/features/attendance/api";
import { AttendanceReportView } from "@/features/attendance/attendance-report-view";
import type { AttendanceRecordFilters } from "@/features/attendance/types";
import { getCurrentUser } from "@/features/auth/api";
import { getServerToken } from "@/lib/server-auth";

export default async function AsistenciaReportePage({
  searchParams,
}: {
  searchParams?: Promise<{
    buscar?: string;
    desde?: string;
    empresa?: string;
    estado?: string;
    hasta?: string;
  }>;
}) {
  const params = await searchParams;
  const to = normalizeDate(params?.hasta);
  const from = normalizeDate(params?.desde, subtractDays(to, 6));
  const recordFilters = normalizeRecordFilters(params);
  const token = await getServerToken();
  const [currentUser, records] = await Promise.all([
    getCurrentUser(token),
    getAttendanceRange(from, to, token),
  ]);

  return (
    <AttendanceReportView
      currentUser={currentUser}
      from={from}
      recordFilters={recordFilters}
      records={records}
      to={to}
    />
  );
}

function normalizeRecordFilters(
  params: { buscar?: string; empresa?: string; estado?: string } | undefined,
): AttendanceRecordFilters {
  return {
    companyId: params?.empresa?.trim() || undefined,
    search: params?.buscar?.trim() || undefined,
    status: normalizeStatus(params?.estado),
  };
}

function normalizeStatus(value: string | undefined) {
  if (
    value === "PRESENT" ||
    value === "LATE" ||
    value === "ABSENT" ||
    value === "ON_LEAVE"
  ) {
    return value;
  }

  return undefined;
}

function normalizeDate(value: string | undefined, fallback = todayInputValue()) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return fallback;
}

function subtractDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - days);

  return toInputValue(date);
}

function todayInputValue() {
  return toInputValue(new Date());
}

function toInputValue(value: Date) {
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 10);
}
