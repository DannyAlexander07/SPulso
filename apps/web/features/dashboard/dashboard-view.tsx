import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FilePlus2,
  FileClock,
  FileSignature,
  FileWarning,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { AttendanceRecord, AttendanceSummary } from "@/features/attendance/types";
import {
  canCreateRequests,
  canManageCompanies,
  canManageDocuments,
  canManageEmployees,
  canViewAttendance,
  canViewDocuments,
  canViewRequests,
} from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import type { DocumentsSummary, EmployeeDocument } from "@/features/documents/types";
import type { Employee } from "@/features/employees/types";
import type { RequestsSummary } from "@/features/requests/types";
import { formatCalendarDate } from "@/lib/date";

export function DashboardView({
  attendanceRecords,
  attendanceSummary,
  companies,
  currentUser,
  documentsSummary,
  employees,
  expiredDocuments,
  pendingSignatureDocuments,
  requestsSummary,
  upcomingDocuments,
}: {
  attendanceRecords: AttendanceRecord[];
  attendanceSummary: AttendanceSummary;
  companies: Company[];
  currentUser: AuthUser | null;
  documentsSummary: DocumentsSummary;
  employees: Employee[];
  expiredDocuments: EmployeeDocument[];
  pendingSignatureDocuments: EmployeeDocument[];
  requestsSummary: RequestsSummary;
  upcomingDocuments: EmployeeDocument[];
}) {
  const activeCompanies = companies.filter((company) => company.status === "ACTIVE");
  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE");
  const lateRecords = attendanceRecords.filter((record) => record.status === "LATE");
  const activeUpcomingDocuments = upcomingDocuments.filter((document) => document.status !== "EXPIRED");
  const companyPeopleCounts = activeCompanies.map((company) => ({
    company,
    count: activeEmployees.filter((employee) => employee.company.id === company.id).length,
  }));
  const heroActions = [
    {
      href: "/asistencia",
      icon: CalendarCheck,
      label: "Ver asistencia",
      visible: canViewAttendance(currentUser),
    },
    {
      href: "/solicitudes?estado=PENDING",
      icon: Clock3,
      label: "Pendientes",
      visible: canViewRequests(currentUser),
    },
    {
      href: "/documentos?estado=PENDING_SIGNATURE",
      icon: FileSignature,
      label: "Por firmar",
      visible: canViewDocuments(currentUser),
    },
  ].filter((action) => action.visible);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Dashboard" title="Centro operativo" />

          <div className="w-full px-3 py-3 pb-24 sm:px-4 lg:px-5 lg:pb-4">
            <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="animate-rise overflow-hidden rounded-[20px] border border-[#e1e5eb] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div className="grid gap-3 p-3.5 lg:grid-cols-[minmax(0,1fr)_270px] lg:p-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#f7f7ff] px-3 py-1 text-xs font-semibold text-[#4f46e5]">
                      <Activity className="h-3.5 w-3.5" />
                      Pulso de Grupo SP
                    </div>
                    <h2 className="mt-3 max-w-3xl text-[1.65rem] font-semibold leading-tight tracking-normal">
                      Operacion, personas y alertas en tiempo real.
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-5 text-[#667085]">
                      Vista ejecutiva para controlar empresas, trabajadores, asistencia, documentos y aprobaciones desde un solo lugar.
                    </p>
                    {heroActions.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {heroActions.map((action) => (
                          <QuickAction href={action.href} icon={action.icon} key={action.label} label={action.label} />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Metric label="Empresas" value={activeCompanies.length.toString()} />
                    <Metric label="Trabajadores" value={activeEmployees.length.toString()} tone="emerald" />
                    <Metric label="Asistencia" value={`${attendanceSummary.attendanceRate}%`} tone="blue" />
                    <Metric label="Tardanzas" value={attendanceSummary.late.toString()} tone="amber" />
                  </div>
                </div>
              </div>

              <AttendanceStatus summary={attendanceSummary} />
            </section>

            <section className="mt-3 grid gap-3 xl:grid-cols-[300px_1fr]">
              <QuickActionsPanel currentUser={currentUser} />
              <OperationalChartsPanel
                attendanceSummary={attendanceSummary}
                companyPeopleCounts={companyPeopleCounts}
                documentsSummary={documentsSummary}
                requestsSummary={requestsSummary}
              />
            </section>

            <section className="mt-3">
              <AlertsPanel
                attendanceSummary={attendanceSummary}
                documentsSummary={documentsSummary}
                requestsSummary={requestsSummary}
              />
            </section>

            <section className="mt-3 grid gap-3 xl:grid-cols-4">
              <LateAttendancePanel records={lateRecords} />
              <DocumentAlertPanel
                documents={pendingSignatureDocuments}
                emptyMessage="No hay documentos esperando firma."
                href="/documentos?estado=PENDING_SIGNATURE"
                title="Por firmar"
              />
              <DocumentAlertPanel
                documents={activeUpcomingDocuments}
                emptyMessage="No hay documentos por vencer en los proximos 30 dias."
                href="/documentos"
                icon={FileClock}
                title="Por vencer"
              />
              <DocumentAlertPanel
                documents={expiredDocuments}
                emptyMessage="No hay documentos vencidos."
                href="/documentos?estado=EXPIRED"
                title="Vencidos"
                tone="red"
              />
            </section>

          </div>
        </section>
      </div>
    </main>
  );
}

function LateAttendancePanel({ records }: { records: AttendanceRecord[] }) {
  return (
    <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            Asistencia
          </p>
          <h2 className="mt-1 text-lg font-semibold">Tardanzas de hoy</h2>
        </div>
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#c7d2fe] bg-[#f7f7ff] px-3 text-xs font-semibold text-[#4f46e5] transition hover:bg-[#c7d2fe]"
          href="/asistencia?estado=LATE"
        >
          Ver detalle
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 space-y-2">
        {records.length > 0 ? (
          records.slice(0, 4).map((record) => (
            <div
              className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-2.5"
              key={record.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-normal break-words text-sm font-semibold leading-5">
                    {record.employee.firstName} {record.employee.lastName}
                  </p>
                  <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">
                    {record.employee.jobTitle ?? "Sin cargo"} · {record.company.name}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#fff7df] px-2.5 py-1 text-[11px] font-bold text-[#b86b00]">
                  {formatTime(record.checkIn)}
                </span>
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#667085]">
                <MapPin className="h-3.5 w-3.5" />
                {record.checkInLatitude !== null && record.checkInLongitude !== null ? "Con GPS" : "Sin GPS"}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-[16px] border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-3 text-sm text-[#667085]">
            No hay tardanzas registradas hoy.
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentAlertPanel({
  documents,
  emptyMessage,
  href,
  icon: Icon = FileSignature,
  title,
  tone = "amber",
}: {
  documents: EmployeeDocument[];
  emptyMessage: string;
  href: string;
  icon?: React.ElementType;
  title: string;
  tone?: "amber" | "red";
}) {
  const toneClassName =
    tone === "red" ? "bg-[#fee4e2] text-[#b42318]" : "bg-[#fff7df] text-[#b86b00]";

  return (
    <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[12px] ${toneClassName}`}>
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="mt-1 text-base font-semibold">{title}</h2>
        </div>
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#c7d2fe] bg-[#f7f7ff] px-3 text-xs font-semibold text-[#4f46e5] transition hover:bg-[#c7d2fe]"
          href={href}
        >
          Ver todos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 space-y-2">
        {documents.length > 0 ? (
          documents.slice(0, 4).map((document) => (
            <div
              className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-2.5"
              key={document.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-normal break-words text-sm font-semibold leading-5">{document.title}</p>
                  <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">
                    {document.employee.firstName} {document.employee.lastName} · {document.company.name}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClassName}`}>
                  {document.expiresAt ? formatDate(document.expiresAt) : "Sin fecha"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-[16px] border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-3 text-sm text-[#667085]">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      className="inline-flex h-8 items-center gap-2 rounded-[12px] border border-[#c7d2fe] bg-[#f7f7ff] px-3 text-xs font-semibold text-[#4f46e5] transition hover:-translate-y-0.5 hover:bg-[#c7d2fe]"
      href={href}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function QuickActionsPanel({ currentUser }: { currentUser: AuthUser | null }) {
  const actions = [
    {
      description: "Alta rapida con empresa, cargo y PIN.",
      href: "/trabajadores",
      icon: UserPlus,
      label: "Nuevo trabajador",
      tone: "blue" as const,
      visible: canManageEmployees(currentUser),
    },
    {
      description: "Contrato, politica o certificado.",
      href: "/documentos",
      icon: FilePlus2,
      label: "Nuevo documento",
      tone: "emerald" as const,
      visible: canManageDocuments(currentUser),
    },
    {
      description: "Permiso, remoto o vacaciones.",
      href: "/solicitudes",
      icon: Plus,
      label: "Nueva solicitud",
      tone: "amber" as const,
      visible: canCreateRequests(currentUser),
    },
    {
      description: "Reglas, horarios y tolerancia.",
      href: "/empresas",
      icon: ShieldCheck,
      label: "Configurar empresa",
      tone: "slate" as const,
      visible: canManageCompanies(currentUser),
    },
  ].filter((action) => action.visible);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            Acciones
          </p>
          <h2 className="mt-1 text-lg font-semibold">Atajos inteligentes</h2>
          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Operaciones frecuentes sin buscar modulo por modulo.
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#eef2ff] text-[#4f46e5]">
          <Sparkles className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {actions.map((action, index) => (
          <SmartAction action={action} index={index} key={action.label} />
        ))}
      </div>
    </div>
  );
}

function SmartAction({
  action,
  index,
}: {
  action: {
    description: string;
    href: string;
    icon: React.ElementType;
    label: string;
    tone: "blue" | "emerald" | "amber" | "slate";
  };
  index: number;
}) {
  const tones = {
    amber: "bg-[#fff7df] text-[#b86b00]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    emerald: "bg-[#e0f2fe] text-[#0284c7]",
    slate: "bg-[#f2f4f7] text-[#475467]",
  };

  return (
    <Link
      className="animate-rise group flex items-center gap-2.5 rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-[#818cf8] hover:bg-white hover:shadow-[0_12px_28px_rgba(16,24,40,0.07)]"
      href={action.href}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${tones[action.tone]}`}>
        <action.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-normal break-words text-sm font-semibold leading-5">{action.label}</span>
        <span className="mt-0.5 block whitespace-normal break-words text-xs leading-4 text-[#667085]">{action.description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#98a2b3] transition group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
    </Link>
  );
}

function OperationalChartsPanel({
  attendanceSummary,
  companyPeopleCounts,
  documentsSummary,
  requestsSummary,
}: {
  attendanceSummary: AttendanceSummary;
  companyPeopleCounts: Array<{ company: Company; count: number }>;
  documentsSummary: DocumentsSummary;
  requestsSummary: RequestsSummary;
}) {
  return (
    <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            Analitica
          </p>
          <h2 className="mt-1 text-lg font-semibold">Lectura rapida del dia</h2>
          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Indicadores visuales para decidir que atender primero.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#c7d2fe] bg-[#f7f7ff] px-3 py-2 text-xs font-semibold text-[#4f46e5]">
          <BarChart3 className="h-4 w-4" />
          En vivo
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <AttendanceChart summary={attendanceSummary} />
        <RequestsChart summary={requestsSummary} />
        <DocumentsChart summary={documentsSummary} />
      </div>

      <CompanyDistribution counts={companyPeopleCounts} />
    </div>
  );
}

function AttendanceChart({ summary }: { summary: AttendanceSummary }) {
  const items = [
    { className: "bg-[#0284c7]", label: "Presentes", value: summary.present },
    { className: "bg-[#d97706]", label: "Tardanzas", value: summary.late },
    { className: "bg-[#4f46e5]", label: "Permisos", value: summary.onLeave },
    { className: "bg-[#d92d20]", label: "Ausentes", value: summary.absent },
  ];

  return (
    <ChartCard title="Asistencia" value={`${summary.attendanceRate}%`} subtitle="registrada hoy">
      <StackedBar items={items} total={Math.max(summary.totalEmployees, 1)} />
      <ChartLegend items={items} />
    </ChartCard>
  );
}

function RequestsChart({ summary }: { summary: RequestsSummary }) {
  const items = [
    { className: "bg-[#d97706]", label: "Pendientes", value: summary.pending },
    { className: "bg-[#0284c7]", label: "Aprobadas", value: summary.approved },
    { className: "bg-[#d92d20]", label: "Rechazadas", value: summary.rejected },
    { className: "bg-[#98a2b3]", label: "Canceladas", value: summary.cancelled },
  ];

  return (
    <ChartCard title="Solicitudes" value={String(summary.pending)} subtitle="por resolver">
      <StackedBar items={items} total={Math.max(summary.total, 1)} />
      <ChartLegend items={items} />
    </ChartCard>
  );
}

function DocumentsChart({ summary }: { summary: DocumentsSummary }) {
  const items = [
    { className: "bg-[#4f46e5]", label: "Por firmar", value: summary.pendingSignature },
    { className: "bg-[#0284c7]", label: "Firmados", value: summary.signed },
    { className: "bg-[#d92d20]", label: "Vencidos", value: summary.expired },
    { className: "bg-[#98a2b3]", label: "Borradores", value: summary.draft },
  ];

  return (
    <ChartCard title="Documentos" value={String(summary.expired)} subtitle="vencidos">
      <StackedBar items={items} total={Math.max(summary.total, 1)} />
      <ChartLegend items={items} />
    </ChartCard>
  );
}

function ChartCard({
  children,
  subtitle,
  title,
  value,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-[#667085]">{subtitle}</p>
        </div>
        <span className="rounded-[12px] bg-white px-2.5 py-1 text-lg font-bold text-[#1f242d] shadow-sm">
          {value}
        </span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function StackedBar({
  items,
  total,
}: {
  items: Array<{ className: string; label: string; value: number }>;
  total: number;
}) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-[#e8edf4]">
      {items.map((item) => {
        const width = total > 0 ? Math.max((item.value / total) * 100, item.value > 0 ? 5 : 0) : 0;

        return (
          <div
            aria-label={`${item.label}: ${item.value}`}
            className={`${item.className} transition-[width] duration-700 ease-out`}
            key={item.label}
            style={{ width: `${width}%` }}
            title={`${item.label}: ${item.value}`}
          />
        );
      })}
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ className: string; label: string; value: number }> }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5">
      {items.map((item) => (
        <div className="flex items-center justify-between gap-2 rounded-[12px] bg-white px-2.5 py-1.5 text-xs" key={item.label}>
          <span className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.className}`} />
            <span className="min-w-0 whitespace-normal break-words text-[#667085]">{item.label}</span>
          </span>
          <span className="font-bold text-[#1f242d]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function CompanyDistribution({ counts }: { counts: Array<{ company: Company; count: number }> }) {
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="mt-3 rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Distribucion por empresa</p>
          <p className="mt-1 text-xs text-[#667085]">Trabajadores activos por unidad.</p>
        </div>
        <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-[#1f242d] shadow-sm">
          {total}
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {counts.length > 0 ? (
          counts.map((item) => {
            const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;

            return (
              <div className="rounded-[12px] bg-white p-2.5" key={item.company.id}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 whitespace-normal break-words font-semibold">{item.company.name}</span>
                  <span className="font-bold text-[#667085]">{item.count} · {percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8edf4]">
                  <div
                    className="h-full rounded-full bg-[#4f46e5] transition-[width] duration-700 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed border-[#d8dee8] bg-white p-3 text-sm text-[#667085] md:col-span-2">
            Aun no hay empresas activas para graficar.
          </p>
        )}
      </div>
    </div>
  );
}

function AlertsPanel({
  attendanceSummary,
  documentsSummary,
  requestsSummary,
}: {
  attendanceSummary: AttendanceSummary;
  documentsSummary: DocumentsSummary;
  requestsSummary: RequestsSummary;
}) {
  const alerts = [
    {
      href: "/solicitudes?estado=PENDING",
      icon: Clock3,
      label: "Solicitudes por atender",
      meta: requestsSummary.pending === 1 ? "1 pendiente" : `${requestsSummary.pending} pendientes`,
      priority: requestsSummary.pending > 0 ? 2 : 0,
      tone: "amber" as const,
      value: requestsSummary.pending,
    },
    {
      href: "/documentos?estado=PENDING_SIGNATURE",
      icon: FileSignature,
      label: "Documentos por firmar",
      meta:
        documentsSummary.pendingSignature === 1
          ? "1 pendiente"
          : `${documentsSummary.pendingSignature} pendientes`,
      priority: documentsSummary.pendingSignature > 0 ? 2 : 0,
      tone: "blue" as const,
      value: documentsSummary.pendingSignature,
    },
    {
      href: "/documentos?estado=EXPIRED",
      icon: FileWarning,
      label: "Documentos vencidos",
      meta: documentsSummary.expired === 1 ? "1 vencido" : `${documentsSummary.expired} vencidos`,
      priority: documentsSummary.expired > 0 ? 3 : 0,
      tone: "red" as const,
      value: documentsSummary.expired,
    },
    {
      href: "/asistencia",
      icon: BellRing,
      label: "Tardanzas de hoy",
      meta: attendanceSummary.late === 1 ? "1 tardanza" : `${attendanceSummary.late} tardanzas`,
      priority: attendanceSummary.late > 0 ? 2 : 0,
      tone: "amber" as const,
      value: attendanceSummary.late,
    },
  ].sort((current, next) => next.priority - current.priority);

  return (
    <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            Alertas
          </p>
          <h2 className="mt-1 text-lg font-semibold">Pendientes operativos</h2>
          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Ordenado por lo que necesita atencion primero.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {alerts.map((alert, index) => (
          <AlertCard alert={alert} index={index} key={alert.label} />
        ))}
      </div>
    </div>
  );
}

function AlertCard({
  alert,
  index,
}: {
  alert: {
    href: string;
    icon: React.ElementType;
    label: string;
    meta: string;
    priority: number;
    tone: "blue" | "amber" | "red";
    value: number;
  };
  index: number;
}) {
  const tones = {
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    amber: "bg-[#fff7df] text-[#b86b00]",
    red: "bg-[#fee4e2] text-[#b42318]",
  };

  return (
    <Link
      className="animate-rise group rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_28px_rgba(16,24,40,0.07)]"
      href={alert.href}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-[13px] ${tones[alert.tone]}`}>
          <alert.icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-4 w-4 text-[#98a2b3] transition group-hover:translate-x-0.5 group-hover:text-[#4f46e5]" />
      </div>
      <p className="mt-3 text-sm font-semibold">{alert.label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 whitespace-normal break-words text-xs leading-4 text-[#667085]">
          {alert.value > 0 ? alert.meta : "Sin pendientes"}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${priorityClassName(alert.priority)}`}>
          {priorityLabel(alert.priority)}
        </span>
      </div>
    </Link>
  );
}

function AttendanceStatus({ summary }: { summary: AttendanceSummary }) {
  const attendanceItems = [
    { label: "Presentes hoy", value: summary.present },
    { label: "Tardanzas", value: summary.late },
    { label: "Permisos", value: summary.onLeave },
    { label: "Ausentes", value: summary.absent },
  ];

  return (
    <div className="animate-rise rounded-[20px] border border-[#e1e5eb] bg-white p-3.5 text-[#1f242d] shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Asistencia de hoy</p>
          <p className="mt-0.5 text-[11px] text-[#667085]">
            {summary.attendanceRate}% de asistencia registrada
          </p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-[13px] bg-[#38bdf8]/15 text-[#38bdf8]">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {attendanceItems.map((item) => (
          <div
            className="rounded-[13px] border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2 transition duration-200 hover:bg-white"
            key={item.label}
          >
            <p className="whitespace-normal break-words text-[11px] font-semibold leading-4 text-[#667085]">{item.label}</p>
            <p className="mt-1 text-lg font-semibold leading-none text-[#1f242d]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return formatCalendarDate(value);
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

function priorityLabel(priority: number) {
  if (priority >= 3) {
    return "Critico";
  }

  if (priority >= 2) {
    return "Atender";
  }

  return "OK";
}

function priorityClassName(priority: number) {
  if (priority >= 3) {
    return "bg-[#fee4e2] text-[#b42318]";
  }

  if (priority >= 2) {
    return "bg-[#fff7df] text-[#b86b00]";
  }

  return "bg-[#e0f2fe] text-[#0284c7]";
}

function Metric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "emerald" | "amber";
}) {
  const tones = {
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    emerald: "bg-[#e0f2fe] text-[#0284c7]",
    amber: "bg-[#fff7df] text-[#b86b00]",
  };

  return (
    <div className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className={`mt-2 inline-flex rounded-[12px] px-2.5 py-1 text-lg font-bold ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}
