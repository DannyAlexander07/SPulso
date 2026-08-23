import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  Clock3,
  LocateFixed,
  ShieldCheck,
  TimerOff,
  Umbrella,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { DataTable, DataTableCell, DataTableHead, DataTableHeader } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, Surface } from "@/components/ui/surface";
import type { AuthUser } from "@/features/auth/types";
import { AttendanceRangeFilter } from "./attendance-range-filter";
import { AttendanceRecordFiltersForm } from "./attendance-record-filters";
import { buildRecordCompanies, filterAttendanceRecords } from "./attendance-record-utils";
import { ExportAttendanceButton } from "./export-attendance-button";
import type { AttendanceRecord, AttendanceRecordFilters } from "./types";

export function AttendanceReportView({
  currentUser,
  from,
  recordFilters,
  records,
  to,
}: {
  currentUser: AuthUser | null;
  from: string;
  recordFilters: AttendanceRecordFilters;
  records: AttendanceRecord[];
  to: string;
}) {
  const visibleRecords = filterAttendanceRecords(records, recordFilters);
  const filterCompanies = buildRecordCompanies(records);
  const summary = buildSummary(visibleRecords);
  const companySummary = buildCompanySummary(visibleRecords);
  const workerSummary = buildWorkerSummary(visibleRecords);
  const cards = [
    { label: "Registros", value: visibleRecords.length, icon: CalendarRange, tone: "brand" as const },
    { label: "Presentes", value: summary.present, icon: ShieldCheck, tone: "success" as const },
    { label: "Tardanzas", value: summary.late, icon: Clock3, tone: "warning" as const },
    { label: "Permisos", value: summary.onLeave, icon: Umbrella, tone: "brand" as const },
    { label: "Ausencias", value: summary.absent, icon: TimerOff, tone: "danger" as const },
  ];

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/asistencia" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Asistencia" title="Reporte por fechas" />

          <div className="mx-auto max-w-[1500px] px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
              <Surface compact>
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-[#e1e5eb] bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                  href="/asistencia"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver al control diario
                </Link>
                <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-tight tracking-normal sm:text-3xl">
                  Reporte claro de asistencia por periodo.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">
                  Revisa marcas, tardanzas, permisos y ubicaciones GPS entre fechas sin entrar a detalles tecnicos.
                </p>
              </Surface>

              <AttendanceRangeFilter from={from} to={to} />
            </section>

            <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

            <section className="mt-4 grid gap-4 xl:grid-cols-2">
              <BreakdownPanel
                emptyMessage="No hay empresas con registros en este periodo."
                items={companySummary}
                title="Resumen por empresa"
              />
              <BreakdownPanel
                emptyMessage="No hay trabajadores con registros en este periodo."
                items={workerSummary}
                title="Resumen por trabajador"
              />
            </section>

            <CrudSection
              actions={
                <ExportAttendanceButton
                  filenameDate={`${from}-a-${to}`}
                  records={visibleRecords}
                />
              }
              className="mt-4"
              description={
                visibleRecords.length > 0
                  ? visibleRecords.length === records.length
                    ? `${visibleRecords.length} registros encontrados.`
                    : `${visibleRecords.length} de ${records.length} registros visibles.`
                  : "No hay registros en este rango."
              }
              eyebrow="Periodo"
              filters={
                <AttendanceRecordFiltersForm
                  action="/asistencia/reporte"
                  companies={filterCompanies}
                  filters={recordFilters}
                  hiddenFields={{ desde: from, hasta: to }}
                  resetHref={`/asistencia/reporte?desde=${from}&hasta=${to}`}
                />
              }
              title={`${formatReadableDate(from)} al ${formatReadableDate(to)}`}
            >
              <DataTable tableClassName="min-w-[1040px]">
                  <DataTableHead>
                      <DataTableHeader>Fecha</DataTableHeader>
                      <DataTableHeader>Trabajador</DataTableHeader>
                      <DataTableHeader>Empresa</DataTableHeader>
                      <DataTableHeader>Ingreso</DataTableHeader>
                      <DataTableHeader>Salida</DataTableHeader>
                      <DataTableHeader>Origen</DataTableHeader>
                      <DataTableHeader>Ubicacion</DataTableHeader>
                      <DataTableHeader align="right">Resultado</DataTableHeader>
                  </DataTableHead>
                  <tbody>
                    {visibleRecords.length > 0 ? (
                      visibleRecords.map((record, index) => (
                        <ReportRow index={index} key={record.id} record={record} />
                      ))
                    ) : (
                      <tr>
                        <DataTableCell colSpan={8}>
                          <EmptyState
                            description="Ajusta fechas, empresa o resultado para ver mas registros."
                            icon={CalendarRange}
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

function BreakdownPanel({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: Array<{
    absent: number;
    late: number;
    name: string;
    onLeave: number;
    present: number;
    total: number;
  }>;
  title: string;
}) {
  return (
    <section className="animate-rise rounded-2xl border border-[#e1e5eb] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            Analisis
          </p>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>
        <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-xs font-bold text-[#667085]">
          {items.length}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {items.length > 0 ? (
          items.slice(0, 6).map((item) => (
            <div
              className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-3"
              key={item.name}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-5">{item.name}</p>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#475467]">
                  {item.total} reg.
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
                <MiniStat label="Pres." tone="emerald" value={item.present} />
                <MiniStat label="Tard." tone="amber" value={item.late} />
                <MiniStat label="Perm." tone="blue" value={item.onLeave} />
                <MiniStat label="Aus." tone="red" value={item.absent} />
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-4 text-sm text-[#667085]">
            {emptyMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function MiniStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "blue" | "emerald" | "amber" | "red";
  value: number;
}) {
  const tones = {
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    emerald: "bg-[#e0f2fe] text-[#0284c7]",
    amber: "bg-[#fff7df] text-[#b86b00]",
    red: "bg-[#fee4e2] text-[#b42318]",
  };

  return (
    <div className={`rounded-xl px-2 py-2 ${tones[tone]}`}>
      <p>{value}</p>
      <p className="mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function ReportRow({
  index,
  record,
}: {
  index: number;
  record: AttendanceRecord;
}) {
  const status = statusMeta(record.status);

  return (
    <tr
      className="animate-rise text-sm transition hover:bg-[#f8fafc]"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <DataTableCell className="font-semibold text-[#475467]">
        {formatShortDate(record.workDate)}
      </DataTableCell>
      <DataTableCell>
        <p className="font-semibold">
          {record.employee.firstName} {record.employee.lastName}
        </p>
        <p className="mt-0.5 text-xs text-[#667085]">{record.employee.jobTitle ?? "Sin cargo"}</p>
      </DataTableCell>
      <DataTableCell className="text-[#475467]">{record.company.name}</DataTableCell>
      <DataTableCell className="text-[#475467]">{formatTime(record.checkIn)}</DataTableCell>
      <DataTableCell className="text-[#475467]">{formatTime(record.checkOut)}</DataTableCell>
      <DataTableCell>
        <Badge tone="neutral">{record.source === "worker" ? "Trabajador" : "Manual"}</Badge>
      </DataTableCell>
      <DataTableCell>
        <GpsBadge
          latitude={record.checkInLatitude ?? record.checkOutLatitude}
          longitude={record.checkInLongitude ?? record.checkOutLongitude}
        />
      </DataTableCell>
      <DataTableCell align="right">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
          {status.label}
        </span>
      </DataTableCell>
    </tr>
  );
}

function GpsBadge({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  if (latitude === null || longitude === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f7] px-2 py-1 text-[11px] font-bold text-[#667085]">
        <LocateFixed className="h-3 w-3" />
        Sin GPS
      </span>
    );
  }

  return (
    <a
      className="inline-flex items-center gap-1 rounded-full bg-[#e0f2fe] px-2 py-1 text-[11px] font-bold text-[#0284c7] transition hover:bg-[#bae6fd]"
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
      rel="noreferrer"
      target="_blank"
    >
      <LocateFixed className="h-3 w-3" />
      Ver mapa
    </a>
  );
}

function buildSummary(records: AttendanceRecord[]) {
  return records.reduce(
    (summary, record) => {
      if (record.status === "PRESENT") {
        summary.present += 1;
      }

      if (record.status === "LATE") {
        summary.late += 1;
      }

      if (record.status === "ABSENT") {
        summary.absent += 1;
      }

      if (record.status === "ON_LEAVE") {
        summary.onLeave += 1;
      }

      return summary;
    },
    { absent: 0, late: 0, onLeave: 0, present: 0 },
  );
}

function buildCompanySummary(records: AttendanceRecord[]) {
  const map = new Map<string, ReturnType<typeof createBreakdownItem>>();

  for (const record of records) {
    const key = record.company.id;
    const item = map.get(key) ?? createBreakdownItem(record.company.name);
    addStatusToBreakdown(item, record.status);
    map.set(key, item);
  }

  return sortBreakdownItems([...map.values()]);
}

function buildWorkerSummary(records: AttendanceRecord[]) {
  const map = new Map<string, ReturnType<typeof createBreakdownItem>>();

  for (const record of records) {
    const key = record.employee.id;
    const name = `${record.employee.firstName} ${record.employee.lastName}`;
    const item = map.get(key) ?? createBreakdownItem(name);
    addStatusToBreakdown(item, record.status);
    map.set(key, item);
  }

  return sortBreakdownItems([...map.values()]);
}

function createBreakdownItem(name: string) {
  return {
    absent: 0,
    late: 0,
    name,
    onLeave: 0,
    present: 0,
    total: 0,
  };
}

function addStatusToBreakdown(
  item: ReturnType<typeof createBreakdownItem>,
  status: AttendanceRecord["status"],
) {
  item.total += 1;

  if (status === "PRESENT") {
    item.present += 1;
  }

  if (status === "LATE") {
    item.late += 1;
  }

  if (status === "ABSENT") {
    item.absent += 1;
  }

  if (status === "ON_LEAVE") {
    item.onLeave += 1;
  }
}

function sortBreakdownItems(items: Array<ReturnType<typeof createBreakdownItem>>) {
  return items.sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
}

function statusMeta(status: AttendanceRecord["status"]) {
  const labels = {
    PRESENT: { label: "Presente", className: "bg-[#e0f2fe] text-[#0284c7]" },
    LATE: { label: "Tardanza", className: "bg-[#fff7df] text-[#b86b00]" },
    ABSENT: { label: "Ausente", className: "bg-[#fee4e2] text-[#b42318]" },
    ON_LEAVE: { label: "Permiso", className: "bg-[#eef2ff] text-[#4f46e5]" },
  };

  return labels[status];
}

function formatReadableDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
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
