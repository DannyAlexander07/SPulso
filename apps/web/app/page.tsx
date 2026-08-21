import { getAttendanceSummary, getTodayAttendance } from "@/features/attendance/api";
import { getCurrentUser } from "@/features/auth/api";
import { getCompanies } from "@/features/companies/api";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { getDocuments, getDocumentsSummary } from "@/features/documents/api";
import { getEmployees } from "@/features/employees/api";
import { getRequestsSummary } from "@/features/requests/api";
import { getServerToken } from "@/lib/server-auth";

export default async function Home() {
  const token = await getServerToken();
  const today = toInputDate(new Date());
  const nextThirtyDays = toInputDate(addDays(new Date(), 30));
  const [
    companies,
    currentUser,
    employees,
    attendanceSummary,
    attendanceRecords,
    documentsSummary,
    expiredDocuments,
    pendingSignatureDocuments,
    upcomingDocuments,
    requestsSummary,
  ] = await Promise.all([
    getCompanies(undefined, token),
    getCurrentUser(token),
    getEmployees(undefined, token),
    getAttendanceSummary(undefined, token),
    getTodayAttendance(undefined, token),
    getDocumentsSummary(token),
    getDocuments({ status: "EXPIRED" }, token),
    getDocuments({ status: "PENDING_SIGNATURE" }, token),
    getDocuments({ expiresFrom: today, expiresTo: nextThirtyDays }, token),
    getRequestsSummary(token),
  ]);

  return (
    <DashboardView
      attendanceSummary={attendanceSummary}
      attendanceRecords={attendanceRecords}
      companies={companies}
      currentUser={currentUser}
      documentsSummary={documentsSummary}
      employees={employees}
      expiredDocuments={expiredDocuments}
      pendingSignatureDocuments={pendingSignatureDocuments}
      requestsSummary={requestsSummary}
      upcomingDocuments={upcomingDocuments}
    />
  );
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
