import Link from "next/link";
import { BarChart3, CalendarCheck, Clock3, LocateFixed, ShieldCheck, TimerOff, Umbrella } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { DataTable, DataTableCell, DataTableHead, DataTableHeader } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/surface";
import { canManageAttendance } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Employee } from "@/features/employees/types";
import { AttendanceDateFilter } from "./attendance-date-filter";
import { AttendanceRecordFiltersForm } from "./attendance-record-filters";
import { buildRecordCompanies, filterAttendanceRecords } from "./attendance-record-utils";
import { ExportAttendanceButton } from "./export-attendance-button";
import { MarkAttendanceForm } from "./mark-attendance-form";
import type { AttendanceRecord, AttendanceRecordFilters, AttendanceSummary } from "./types";

export function AttendanceView({
  employees,
  currentUser,
  recordFilters,
  records,
  selectedDate,
  summary,
}: {
  currentUser: AuthUser | null;
  employees: Employee[];
  recordFilters: AttendanceRecordFilters;
  records: AttendanceRecord[];
  selectedDate: string;
  summary: AttendanceSummary;
}) {
  const canManage = canManageAttendance(currentUser);
  const visibleRecords = filterAttendanceRecords(records, recordFilters);
  const filterCompanies = buildRecordCompanies(records);
  const cards = [
    {
      label: "Presentes",
      value: summary.present,
      icon: ShieldCheck,
      tone: "success" as const,
    },
    {
      label: "Tardanzas",
      value: summary.late,
      icon: Clock3,
      tone: "warning" as const,
    },
    {
      label: "Permisos",
      value: summary.onLeave,
      icon: Umbrella,
      tone: "brand" as const,
    },
    {
      label: "Ausentes",
      value: summary.absent,
      icon: TimerOff,
      tone: "danger" as const,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/asistencia" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Asistencia" title="Control diario" />

          <div className="mx-auto max-w-[1500px] px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="animate-rise rounded-[18px] border border-[#e1e5eb] bg-white p-4 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#f7f7ff] px-3 py-1 text-xs font-semibold text-[#4f46e5]">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Jornada actual
                </div>
                <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-normal">
                  {summary.attendanceRate}% de asistencia registrada.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                  Vista para controlar entradas, tardanzas, permisos y ausencias por fecha.
                </p>
              </div>

              <div className="animate-rise rounded-[18px] border border-[#e1e5eb] bg-white p-4 text-[#1f242d] shadow-sm">
                <p className="text-sm font-semibold">Resumen del dia</p>
                <p className="mt-1 text-xs text-[#667085]">
                  Total de trabajadores activos: {summary.totalEmployees}
                </p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#eef2f7]">
                  <div
                    className="h-full rounded-full bg-[#38bdf8] transition-all duration-700"
                    style={{ width: `${summary.attendanceRate}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-[#667085]">Progreso de asistencia diaria</p>
              </div>
            </section>

            <section className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((card, index) => (
                <MetricCard
                  icon={card.icon}
                  key={card.label}
                  label={card.label}
                  tone={card.tone}
                  value={card.value.toString()}
                />
              ))}
            </section>

            <CrudSection
              actions={
                <>
                  {canManage ? <MarkAttendanceForm employees={employees} /> : null}
                  <AttendanceDateFilter selectedDate={selectedDate} />
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#c7d2fe] bg-white px-4 text-sm font-semibold text-[#4f46e5] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f7f7ff]"
                    href={`/asistencia/reporte?desde=${selectedDate}&hasta=${selectedDate}`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Reporte
                  </Link>
                  <ExportAttendanceButton records={visibleRecords} />
                </>
              }
              className="mt-3"
              description={
                visibleRecords.length === records.length
                  ? `Registros del ${formatReadableDate(selectedDate)} por trabajador, empresa y estado.`
                  : `${visibleRecords.length} de ${records.length} registros visibles para el ${formatReadableDate(
                      selectedDate,
                    )}.`
              }
              eyebrow="Registro"
              filters={
                <AttendanceRecordFiltersForm
                  action="/asistencia"
                  companies={filterCompanies}
                  filters={recordFilters}
                  hiddenFields={{ fecha: selectedDate }}
                  resetHref={`/asistencia?fecha=${selectedDate}`}
                />
              }
              title="Detalle de asistencia"
            >
              <DataTable tableClassName="min-w-[1120px]">
                <DataTableHead>
                  <DataTableHeader>Trabajador</DataTableHeader>
                  <DataTableHeader>Empresa</DataTableHeader>
                  <DataTableHeader>Ingreso</DataTableHeader>
                  <DataTableHeader>Salida</DataTableHeader>
                  <DataTableHeader>Origen</DataTableHeader>
                  <DataTableHeader>GPS</DataTableHeader>
                  <DataTableHeader align="right">Estado</DataTableHeader>
                </DataTableHead>
                  <tbody>
                    {visibleRecords.length > 0 ? (
                      visibleRecords.map((record, index) => (
                        <AttendanceRow index={index} key={record.id} record={record} />
                      ))
                    ) : (
                      <tr>
                        <DataTableCell colSpan={7}>
                          <EmptyState
                            description="Cambia el estado, empresa o busqueda para revisar otros registros."
                            icon={CalendarCheck}
                            title="No hay trabajadores que coincidan con los filtros"
                          />
                        </DataTableCell>
                      </tr>
                    )}
                  </tbody>
              </DataTable>
            </CrudSection>
          </div>
        </section>
      </div>
    </main>
  );
}

function formatReadableDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function AttendanceRow({
  index,
  record,
}: {
  index: number;
  record: AttendanceRecord;
}) {
  const status = {
    PRESENT: { label: "Presente", tone: "success" as const },
    LATE: { label: "Tardanza", tone: "warning" as const },
    ABSENT: { label: "Ausente", tone: "danger" as const },
    ON_LEAVE: { label: "Permiso", tone: "brand" as const },
  }[record.status];

  return (
    <tr
      className="animate-rise text-sm transition hover:bg-[#f8fafc]"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <DataTableCell>
        <p className="whitespace-normal break-words font-semibold leading-5">
          {record.employee.firstName} {record.employee.lastName}
        </p>
        <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">{record.employee.jobTitle ?? "Sin cargo"}</p>
      </DataTableCell>
      <DataTableCell className="whitespace-normal break-words text-[#475467]">{record.company.name}</DataTableCell>
      <DataTableCell className="text-[#475467]">{formatTime(record.checkIn)}</DataTableCell>
      <DataTableCell className="text-[#475467]">{formatTime(record.checkOut)}</DataTableCell>
      <DataTableCell>
        <SourceBadge source={record.source} />
      </DataTableCell>
      <DataTableCell>
        <div className="flex flex-wrap gap-1.5">
          <GpsBadge
            label="Entrada"
            latitude={record.checkInLatitude}
            longitude={record.checkInLongitude}
          />
          <GpsBadge
            label="Salida"
            latitude={record.checkOutLatitude}
            longitude={record.checkOutLongitude}
          />
        </div>
      </DataTableCell>
      <DataTableCell align="right">
        <Badge tone={status.tone}>{status.label}</Badge>
      </DataTableCell>
    </tr>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isWorker = source === "worker";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
        isWorker ? "bg-[#eef2ff] text-[#4f46e5]" : "bg-[#f2f4f7] text-[#667085]"
      }`}
    >
      {isWorker ? "Trabajador" : "Manual"}
    </span>
  );
}

function GpsBadge({
  label,
  latitude,
  longitude,
}: {
  label: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const hasGps = latitude !== null && longitude !== null;

  if (!hasGps) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f7] px-2 py-1 text-[11px] font-bold text-[#667085]">
        <LocateFixed className="h-3 w-3" />
        {label}: sin GPS
      </span>
    );
  }

  return (
    <a
      className="inline-flex items-center gap-1 rounded-full bg-[#e0f2fe] px-2 py-1 text-[11px] font-bold text-[#0284c7] transition hover:bg-[#bae6fd]"
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
      rel="noreferrer"
      target="_blank"
      title={`${label}: ${latitude}, ${longitude}`}
    >
      <LocateFixed className="h-3 w-3" />
      {label}: GPS
    </a>
  );
}

function formatTime(value: string | null) {
  if (!value) {
    return "Sin marca";
  }

  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
