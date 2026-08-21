import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  MapPin,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { LinkButton } from "@/components/ui/button";
import { canManageEmployees } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import type { OrganizationData } from "@/features/organization/types";
import { mediaUrl } from "@/lib/api";
import { EmployeeLaborTimeline } from "./employee-labor-timeline";
import { EmployeeRowActions } from "./employee-row-actions";
import type { EmployeeProfile } from "./types";

export function EmployeeProfileView({
  companies,
  currentUser,
  organization,
  profile,
}: {
  companies: Company[];
  currentUser: AuthUser | null;
  organization: OrganizationData;
  profile: EmployeeProfile;
}) {
  const employee = profile.employee;
  const canManage = canManageEmployees(currentUser);
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const openAlerts = profile.notifications.filter((notification) => notification.status === "UNREAD");
  const pendingDocuments = profile.documents.filter((document) =>
    ["EXPIRED", "PENDING_SIGNATURE"].includes(document.status),
  );
  const pendingRequests = profile.requests.filter((request) => request.status === "PENDING");

  return (
    <main className="spulso-employees-module min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/trabajadores" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Trabajadores" title="Perfil 360" />

          <div className="mx-auto max-w-7xl px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <LinkButton href="/trabajadores" icon={ArrowLeft} size="md" variant="secondary">
                Volver al directorio
              </LinkButton>
              <div className="flex flex-wrap gap-2">
                <LinkButton href="/asistencia" icon={CalendarCheck} size="md" variant="soft">
                  Ver asistencia
                </LinkButton>
                <LinkButton href="/documentos" icon={FileText} size="md" variant="soft">
                  Documentos
                </LinkButton>
              </div>
            </div>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[#eef2ff] text-lg font-bold text-[#4f46e5] sm:h-16 sm:w-16 sm:text-xl">
                      {employee.user?.avatarUrl ? (
                        <img
                          alt={fullName}
                          className="h-full w-full rounded-[16px] object-cover"
                          src={mediaUrl(employee.user.avatarUrl)}
                        />
                      ) : (
                        initials(employee.firstName, employee.lastName)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                        Ficha laboral
                      </p>
                      <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">{fullName}</h1>
                      <p className="mt-2 text-sm text-[#667085]">
                        {employee.position?.name ?? employee.jobTitle ?? "Sin cargo"} · {employee.areaRef?.name ?? employee.area ?? "Sin area"} · {employee.company.name}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge label={statusLabel(employee.status)} tone={employee.status === "ACTIVE" ? "emerald" : "slate"} />
                        <Badge label={`Codigo: ${employee.employeeCode ?? "N/A"}`} tone="blue" />
                        <Badge label={`DNI: ${employee.documentNumber ?? "Sin documento"}`} tone="slate" />
                      </div>
                      {employee.status === "TERMINATED" && employee.terminationReason ? (
                        <div className="mt-4 rounded-2xl border border-[#fecaca] bg-[#fff1f0] px-4 py-3 text-sm text-[#b42318]">
                          <p className="font-semibold">Observacion de cese</p>
                          <p className="mt-1 leading-5">{employee.terminationReason}</p>
                          {employee.terminatedAt ? (
                            <p className="mt-1 text-xs font-semibold">
                              Fecha: {formatDate(employee.terminatedAt)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="shrink-0">
                      <EmployeeRowActions companies={companies} employee={employee} organization={organization} />
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                  <InfoTile icon={BriefcaseBusiness} label="Empresa" value={employee.company.name} />
                  <InfoTile icon={UserRound} label="Area" value={employee.areaRef?.name ?? employee.area ?? "Sin area"} />
                  <InfoTile icon={UsersRound} label="Equipo" value={employee.team?.name ?? "Sin equipo"} />
                  <InfoTile
                    icon={ShieldCheck}
                    label="Jefe directo"
                    value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Sin jefe"}
                  />
                  <InfoTile icon={CalendarCheck} label="Ingreso" value={employee.hireDate ? formatDate(employee.hireDate) : "Sin fecha"} />
                  <InfoTile icon={ShieldCheck} label="Estado" value={statusLabel(employee.status)} />
                </div>
              </div>

              <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-4 text-[#1f242d] shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Lectura RRHH</p>
                    <p className="mt-1 text-xs text-[#667085]">Prioridades de atencion.</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 space-y-2.5">
                  <RiskMetric label="Alertas abiertas" value={openAlerts.length} tone={openAlerts.length > 0 ? "red" : "blue"} />
                  <RiskMetric label="Documentos por atender" value={pendingDocuments.length} tone={pendingDocuments.length > 0 ? "amber" : "blue"} />
                  <RiskMetric label="Solicitudes pendientes" value={pendingRequests.length} tone={pendingRequests.length > 0 ? "amber" : "blue"} />
                  <RiskMetric label="Tardanzas 30 dias" value={profile.attendanceSummary.late} tone={profile.attendanceSummary.late > 0 ? "amber" : "blue"} />
                </div>
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-4">
              <MetricCard label="Presentes" value={profile.attendanceSummary.present} tone="emerald" />
              <MetricCard label="Tardanzas" value={profile.attendanceSummary.late} tone="amber" />
              <MetricCard label="Permisos" value={profile.attendanceSummary.onLeave} tone="blue" />
              <MetricCard label="Ausencias" value={profile.attendanceSummary.absent} tone="red" />
            </section>

            <section className="mt-4">
              <EmployeeLaborTimeline events={profile.timelineEvents} />
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <RecentAttendance records={profile.attendance} />
              <RelatedAlerts notifications={profile.notifications} />
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-2">
              <DocumentsPanel documents={profile.documents} />
              <RequestsPanel requests={profile.requests} />
            </section>

            <section className="mt-4">
              <AuditPanel logs={profile.auditLogs} />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function RecentAttendance({ records }: { records: EmployeeProfile["attendance"] }) {
  return (
    <Panel icon={CalendarCheck} title="Asistencia reciente" eyebrow="Ultimos registros">
      <div className="space-y-2">
        {records.length > 0 ? (
          records.map((record) => (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3" key={record.id}>
              <div>
                <p className="text-sm font-semibold">{formatDate(record.workDate)}</p>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Entrada {formatTime(record.checkIn)} · Salida {formatTime(record.checkOut)}
                </p>
              </div>
              <Badge label={attendanceLabel(record.status)} tone={attendanceTone(record.status)} />
            </div>
          ))
        ) : (
          <EmptyState text="Todavia no hay asistencia registrada." />
        )}
      </div>
    </Panel>
  );
}

function RelatedAlerts({ notifications }: { notifications: EmployeeProfile["notifications"] }) {
  return (
    <Panel icon={BellRing} title="Alertas relacionadas" eyebrow="Automatizaciones">
      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3" key={notification.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-normal break-words text-sm font-semibold leading-5">{notification.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667085]">{notification.message}</p>
                </div>
                <Badge label={priorityLabel(notification.priority)} tone={priorityTone(notification.priority)} />
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="No hay alertas relacionadas." />
        )}
      </div>
    </Panel>
  );
}

function DocumentsPanel({ documents }: { documents: EmployeeProfile["documents"] }) {
  return (
    <Panel icon={FileText} title="Documentos" eyebrow="Gestion documental">
      <div className="space-y-2">
        {documents.length > 0 ? (
          documents.map((document) => (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3" key={document.id}>
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-sm font-semibold leading-5">{document.title}</p>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Vence: {document.expiresAt ? formatDate(document.expiresAt) : "Sin fecha"}
                </p>
              </div>
              <Badge label={documentStatusLabel(document.status)} tone={documentStatusTone(document.status)} />
            </div>
          ))
        ) : (
          <EmptyState text="No hay documentos registrados." />
        )}
      </div>
    </Panel>
  );
}

function RequestsPanel({ requests }: { requests: EmployeeProfile["requests"] }) {
  return (
    <Panel icon={Clock3} title="Solicitudes" eyebrow="Flujo laboral">
      <div className="space-y-2">
        {requests.length > 0 ? (
          requests.map((request) => (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3" key={request.id}>
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-sm font-semibold leading-5">{request.title}</p>
                <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">{requestTypeLabel(request.type)} · {formatDate(request.createdAt)}</p>
              </div>
              <Badge label={requestStatusLabel(request.status)} tone={requestStatusTone(request.status)} />
            </div>
          ))
        ) : (
          <EmptyState text="No hay solicitudes registradas." />
        )}
      </div>
    </Panel>
  );
}

function AuditPanel({ logs }: { logs: EmployeeProfile["auditLogs"] }) {
  return (
    <Panel icon={History} title="Historial del trabajador" eyebrow="Auditoria">
      <div className="grid gap-2 md:grid-cols-2">
        {logs.length > 0 ? (
          logs.map((log) => {
            const changes = auditChangeItems(log);

            return (
              <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3" key={log.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{humanAction(log.action)}</p>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">
                      {changes.length > 0
                        ? `Se modificaron ${changes.length} ${changes.length === 1 ? "campo" : "campos"} de la ficha.`
                        : log.summary}
                    </p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#667085] shadow-sm">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                {changes.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {changes.slice(0, 5).map((change) => (
                      <div className="rounded-xl border border-[#e1e5eb] bg-white px-3 py-2" key={change.label}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                          {change.label}
                        </p>
                        <p className="mt-1 whitespace-normal break-words text-xs font-semibold leading-5 text-[#344054]">
                          <span className="text-[#667085]">{change.before}</span>
                          <span className="px-1.5 text-[#4f46e5]">→</span>
                          <span>{change.after}</span>
                        </p>
                      </div>
                    ))}
                    {changes.length > 5 ? (
                      <p className="text-xs font-semibold text-[#667085]">
                        + {changes.length - 5} cambios adicionales
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-3 text-xs font-medium text-[#667085]">
                  {log.actorLabel} · {log.company?.name ?? "Grupo completo"}
                </p>
              </div>
            );
          })
        ) : (
          <div className="md:col-span-2">
            <EmptyState text="No hay eventos de auditoria para este trabajador." />
          </div>
        )}
      </div>
    </Panel>
  );
}

function Panel({
  children,
  eyebrow,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[#e1e5eb] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="min-h-[104px] rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <Icon className="h-4 w-4 text-[#4f46e5]" />
      <p className="mt-3 text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-5 text-[#1f242d]">{value}</p>
    </div>
  );
}

function MetricCard({ label, tone, value }: { label: string; tone: "amber" | "blue" | "emerald" | "red"; value: number }) {
  const tones = {
    amber: "bg-[#fff7df] text-[#b86b00]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    emerald: "bg-[#e0f2fe] text-[#0284c7]",
    red: "bg-[#fee4e2] text-[#b42318]",
  };

  return (
    <article className="rounded-2xl border border-[#e1e5eb] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#667085]">{label}</p>
      <p className={`mt-3 inline-flex rounded-xl px-3 py-1.5 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </article>
  );
}

function RiskMetric({ label, tone, value }: { label: string; tone: "amber" | "blue" | "red"; value: number }) {
  const tones = {
    amber: "bg-[#fff7df] text-[#b86b00]",
    blue: "bg-[#e0f2fe] text-[#0284c7]",
    red: "bg-[#fee4e2] text-[#b42318]",
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2.5">
      <span className="text-sm font-medium text-[#667085]">{label}</span>
      <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${tones[tone]}`}>{value}</span>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "amber" | "blue" | "emerald" | "red" | "slate" }) {
  const tones = {
    amber: "bg-[#fff7df] text-[#b86b00]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    emerald: "bg-[#e0f2fe] text-[#0284c7]",
    red: "bg-[#fee4e2] text-[#b42318]",
    slate: "bg-[#f2f4f7] text-[#667085]",
  };

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-4 text-sm text-[#667085]">{text}</p>;
}

function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "Sin marca";
  return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: EmployeeProfile["employee"]["status"]) {
  return { ACTIVE: "Activo", INACTIVE: "Inactivo", TERMINATED: "Cesado" }[status];
}

function attendanceLabel(status: EmployeeProfile["attendance"][number]["status"]) {
  return { ABSENT: "Ausente", LATE: "Tardanza", ON_LEAVE: "Permiso", PRESENT: "Presente" }[status];
}

function attendanceTone(status: EmployeeProfile["attendance"][number]["status"]) {
  return ({ ABSENT: "red", LATE: "amber", ON_LEAVE: "blue", PRESENT: "emerald" } as const)[status];
}

function documentStatusLabel(status: EmployeeProfile["documents"][number]["status"]) {
  return { DRAFT: "Borrador", EXPIRED: "Vencido", PENDING_SIGNATURE: "Por firmar", SIGNED: "Firmado" }[status];
}

function documentStatusTone(status: EmployeeProfile["documents"][number]["status"]) {
  return ({ DRAFT: "slate", EXPIRED: "red", PENDING_SIGNATURE: "amber", SIGNED: "emerald" } as const)[status];
}

function requestStatusLabel(status: EmployeeProfile["requests"][number]["status"]) {
  return { APPROVED: "Aprobada", CANCELLED: "Cancelada", PENDING: "Pendiente", REJECTED: "Rechazada" }[status];
}

function requestStatusTone(status: EmployeeProfile["requests"][number]["status"]) {
  return ({ APPROVED: "emerald", CANCELLED: "slate", PENDING: "amber", REJECTED: "red" } as const)[status];
}

function requestTypeLabel(type: EmployeeProfile["requests"][number]["type"]) {
  return { MEDICAL_LEAVE: "Descanso medico", OTHER: "Otro", PERMISSION: "Permiso", REMOTE_WORK: "Remoto", VACATION: "Vacaciones" }[type];
}

function priorityLabel(priority: EmployeeProfile["notifications"][number]["priority"]) {
  return { CRITICAL: "Critica", INFO: "Info", WARNING: "Atender" }[priority];
}

function priorityTone(priority: EmployeeProfile["notifications"][number]["priority"]) {
  return ({ CRITICAL: "red", INFO: "blue", WARNING: "amber" } as const)[priority];
}

function humanAction(action: string) {
  const labels: Record<string, string> = {
    "employee.attendance_pin.self_updated": "PIN personal actualizado",
    "employee.attendance_pin.updated": "PIN actualizado",
    "employee.created": "Trabajador creado",
    "employee.updated": "Trabajador actualizado",
  };

  return labels[action] ?? "Cambio registrado";
}

function auditChangeItems(log: EmployeeProfile["auditLogs"][number]) {
  if (!log.before || !log.after) return [];

  const fields: Array<{
    key: string;
    label: string;
    formatter?: (value: unknown) => string;
  }> = [
    { key: "firstName", label: "Nombres" },
    { key: "lastName", label: "Apellidos" },
    { key: "documentNumber", label: "DNI" },
    { key: "employeeCode", label: "Codigo interno" },
    { key: "company", label: "Empresa", formatter: formatAuditCompany },
    { key: "area", label: "Area" },
    { key: "jobTitle", label: "Cargo" },
    { key: "hireDate", label: "Fecha de ingreso", formatter: formatAuditDate },
    { key: "status", label: "Estado", formatter: formatAuditStatus },
    { key: "terminatedAt", label: "Fecha de cese", formatter: formatAuditDate },
    { key: "terminationReason", label: "Observacion de cese" },
    { key: "managerId", label: "Jefe directo", formatter: formatAuditRelationChange },
    { key: "teamId", label: "Equipo", formatter: formatAuditRelationChange },
    { key: "areaId", label: "Area estructurada", formatter: formatAuditRelationChange },
    { key: "positionId", label: "Cargo estructurado", formatter: formatAuditRelationChange },
  ];

  return fields
    .map((field) => {
      const before = log.before?.[field.key];
      const after = log.after?.[field.key];

      if (auditValuesAreEqual(before, after)) return null;

      const formatter = field.formatter ?? formatAuditValue;

      return {
        label: field.label,
        before: formatter(before),
        after: formatter(after),
      };
    })
    .filter((item): item is { label: string; before: string; after: string } => Boolean(item));
}

function auditValuesAreEqual(before: unknown, after: unknown) {
  return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "Cambio registrado";
}

function formatAuditCompany(value: unknown) {
  if (!value || typeof value !== "object") return "Sin empresa";
  const company = value as { name?: unknown };
  return typeof company.name === "string" && company.name.trim() ? company.name : "Sin empresa";
}

function formatAuditDate(value: unknown) {
  if (typeof value !== "string" || !value) return "Sin fecha";
  return formatDate(value);
}

function formatAuditStatus(value: unknown) {
  if (value === "ACTIVE" || value === "INACTIVE" || value === "TERMINATED") {
    return statusLabel(value);
  }

  return formatAuditValue(value);
}

function formatAuditRelationChange(value: unknown) {
  return value ? "Asignado / cambiado" : "Sin asignar";
}
