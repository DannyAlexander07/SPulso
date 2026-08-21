import { getAttendanceSummary, getTodayAttendance } from "@/features/attendance/api";
import { AttendanceView } from "@/features/attendance/attendance-view";
import type { AttendanceRecordFilters } from "@/features/attendance/types";
import { getCurrentUser } from "@/features/auth/api";
import { getEmployees } from "@/features/employees/api";
import { getServerToken } from "@/lib/server-auth";

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams?: Promise<{ buscar?: string; empresa?: string; estado?: string; fecha?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = normalizeDate(params?.fecha);
  const recordFilters = normalizeRecordFilters(params);
  const token = await getServerToken();

  const [currentUser, employees, records, summary] = await Promise.all([
    getCurrentUser(token),
    getEmployees(undefined, token),
    getTodayAttendance(selectedDate, token),
    getAttendanceSummary(selectedDate, token),
  ]);

  return (
    <AttendanceView
      currentUser={currentUser}
      employees={employees}
      recordFilters={recordFilters}
      records={records}
      selectedDate={selectedDate}
      summary={summary}
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

function normalizeDate(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localToday = new Date(today.getTime() - offset * 60 * 1000);

  return localToday.toISOString().slice(0, 10);
}
