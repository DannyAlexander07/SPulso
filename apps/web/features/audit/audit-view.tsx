import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Activity, History, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, Surface } from "@/components/ui/surface";
import { canViewAudit } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import { AuditFiltersForm } from "./audit-filters";
import type { AuditFilters, AuditLog, AuditPagination } from "./types";

export function AuditView({
  companies,
  currentUser,
  filters,
  logs,
  pagination,
}: {
  companies: Company[];
  currentUser: AuthUser | null;
  filters: AuditFilters;
  logs: AuditLog[];
  pagination: AuditPagination;
}) {
  const canView = canViewAudit(currentUser);
  const systemLogs = logs.filter((log) => log.actorType === "system");
  const companyLogs = logs.filter((log) => log.company);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/auditoria" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar
            currentUser={currentUser}
            eyebrow="Auditoria"
            title="Trazabilidad del sistema"
          />

          <div className="mx-auto max-w-7xl px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            {!canView ? (
              <Surface>
                <EmptyState
                  description="Pide a un administrador que habilite el permiso de auditoria para tu rol."
                  icon={ShieldCheck}
                  title="No tienes permisos para ver la auditoria"
                />
              </Surface>
            ) : (
              <>
                <section className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    icon={History}
                    label="Eventos cargados"
                    value={logs.length.toString()}
                  />
                  <MetricCard
                    icon={ShieldCheck}
                    label="Eventos sistema"
                    tone="success"
                    value={systemLogs.length.toString()}
                  />
                  <MetricCard
                    icon={Activity}
                    label="Con empresa"
                    tone="warning"
                    value={companyLogs.length.toString()}
                  />
                </section>

                <CrudSection
                  className="mt-4"
                  description={
                    <>
                      Cambios importantes realizados en configuraciones, reglas
                      y procesos.{" "}
                      {logs.length > 0
                        ? paginationLabel(pagination, logs.length)
                        : "Sin resultados."}
                    </>
                  }
                  eyebrow="Historial"
                  filters={
                    <AuditFiltersForm companies={companies} filters={filters} />
                  }
                  title="Eventos recientes"
                >
                  <DataTable tableClassName="min-w-[1120px]">
                    <DataTableHead>
                      <DataTableHeader>Fecha</DataTableHeader>
                      <DataTableHeader>Actor</DataTableHeader>
                      <DataTableHeader>Empresa</DataTableHeader>
                      <DataTableHeader>Accion</DataTableHeader>
                      <DataTableHeader>Resumen</DataTableHeader>
                      <DataTableHeader>Cambio</DataTableHeader>
                    </DataTableHead>
                    <tbody>
                      {logs.length > 0 ? (
                        logs.map((log, index) => (
                          <AuditRow index={index} key={log.id} log={log} />
                        ))
                      ) : (
                        <tr>
                          <DataTableCell colSpan={6}>
                            <EmptyState
                              description="Cambia fechas, empresa o actor para ampliar la busqueda."
                              icon={History}
                              title="No hay eventos con los filtros seleccionados"
                            />
                          </DataTableCell>
                        </tr>
                      )}
                    </tbody>
                  </DataTable>
                  <AuditPaginationControls
                    filters={filters}
                    pagination={pagination}
                  />
                </CrudSection>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function AuditPaginationControls({
  filters,
  pagination,
}: {
  filters: AuditFilters;
  pagination: AuditPagination;
}) {
  return (
    <CursorPagination
      className="mt-5"
      firstHref={`/auditoria?${buildPaginationQuery(filters)}`}
      hasNextPage={pagination.hasNextPage}
      nextHref={`/auditoria?${buildPaginationQuery(filters, pagination.nextCursor ?? undefined)}`}
      totalLabel={cursorLabel(filters.cursor, pagination.hasNextPage)}
    />
  );
}

function buildPaginationQuery(filters: AuditFilters, cursor?: string) {
  const query = new URLSearchParams();

  if (filters.search) {
    query.set("buscar", filters.search);
  }

  if (filters.actorType) {
    query.set("actor", filters.actorType);
  }

  if (filters.companyId) {
    query.set("empresa", filters.companyId);
  }

  if (filters.from) {
    query.set("desde", filters.from);
  }

  if (filters.to) {
    query.set("hasta", filters.to);
  }

  if (cursor) {
    query.set("cursor", cursor);
  }

  query.set("porPagina", String(filters.pageSize ?? 20));

  return query.toString();
}

function paginationLabel(pagination: AuditPagination, visibleCount: number) {
  if (pagination.total === null || pagination.totalPages === null) {
    return `Mostrando ${visibleCount} eventos${pagination.hasNextPage ? " · hay mas resultados" : ""}`;
  }

  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return `Mostrando ${start}-${end} de ${pagination.total}`;
}

function cursorLabel(cursor: string | undefined, hasNextPage: boolean) {
  if (cursor) {
    return hasNextPage
      ? "Pagina cargada · hay mas eventos"
      : "Ultima pagina de eventos";
  }

  return hasNextPage
    ? "Primeros eventos cargados · hay mas resultados"
    : "Todos los eventos filtrados estan visibles";
}

function AuditRow({ index, log }: { index: number; log: AuditLog }) {
  return (
    <tr
      className="animate-rise text-sm transition hover:bg-[#f8fafc]"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <DataTableCell className="text-[#475467]">
        {formatDateTime(log.createdAt)}
      </DataTableCell>
      <DataTableCell>
        <p className="whitespace-normal break-words font-semibold leading-5">
          {log.actorLabel}
        </p>
        <p className="mt-0.5 text-xs text-[#667085]">
          {actorTypeLabel(log.actorType)}
        </p>
      </DataTableCell>
      <DataTableCell className="whitespace-normal break-words text-[#475467]">
        {log.company?.name ?? "Global"}
      </DataTableCell>
      <DataTableCell>
        <Badge tone="brand">{actionLabel(log.action)}</Badge>
      </DataTableCell>
      <DataTableCell>
        <p className="max-w-sm whitespace-normal break-words text-sm font-medium leading-5">
          {log.summary}
        </p>
        <p className="mt-0.5 text-xs text-[#667085]">
          Registro interno · {log.entityId.slice(0, 8)}
        </p>
      </DataTableCell>
      <DataTableCell>
        <ChangePreview before={log.before} after={log.after} />
      </DataTableCell>
    </tr>
  );
}

function ChangePreview({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) {
    return <span className="text-xs text-[#667085]">Sin detalle</span>;
  }

  return (
    <div className="grid gap-1 text-xs text-[#667085]">
      <span className="rounded-xl bg-[#f8fafc] px-2 py-1 break-words">
        Antes:{" "}
        <strong className="text-[#475467]">{humanizeChange(before)}</strong>
      </span>
      <span className="rounded-xl bg-[#f8fafc] px-2 py-1 break-words">
        Despues:{" "}
        <strong className="text-[#475467]">{humanizeChange(after)}</strong>
      </span>
    </div>
  );
}

function humanizeChange(value: Record<string, unknown> | null) {
  if (!value) {
    return "N/A";
  }

  return Object.entries(value)
    .filter(([key]) => key !== "id")
    .map(
      ([key, entry]) => `${fieldLabel(key)}: ${formatFieldValue(key, entry)}`,
    )
    .join(", ");
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = {
    workStartTime: "Hora de entrada",
    lateToleranceMinutes: "Tolerancia",
    pin: "PIN",
    email: "Correo",
    firstName: "Nombres",
    lastName: "Apellidos",
    documentNumber: "Documento",
    employeeCode: "Codigo",
    jobTitle: "Cargo",
    area: "Area",
    hireDate: "Fecha ingreso",
    status: "Estado",
    company: "Empresa",
    slug: "Identificador",
    ruc: "RUC",
    title: "Titulo",
    type: "Tipo",
    fileUrl: "Archivo",
    issuedAt: "Emision",
    expiresAt: "Vencimiento",
    startDate: "Inicio",
    endDate: "Fin",
    attendance: "Asistencia",
    workDate: "Fecha",
    checkIn: "Ingreso",
    checkOut: "Salida",
    source: "Origen",
    notes: "Notas",
    employee: "Trabajador",
    role: "Rol",
    name: "Nombre",
    description: "Descripcion",
    permissions: "Permisos",
  };

  return labels[key] ?? key;
}

function formatFieldValue(key: string, value: unknown) {
  if (key === "lateToleranceMinutes") {
    return `${String(value)} min`;
  }

  if (
    (key === "hireDate" ||
      key === "issuedAt" ||
      key === "expiresAt" ||
      key === "startDate" ||
      key === "endDate" ||
      key === "workDate") &&
    value
  ) {
    return formatDate(String(value));
  }

  if ((key === "checkIn" || key === "checkOut") && value) {
    return formatTime(String(value));
  }

  if (key === "company" || key === "role" || key === "employee") {
    return formatNamedObject(value);
  }

  if (key === "permissions" && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} permisos` : "Sin permisos";
  }

  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  return String(value);
}

function formatNamedObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return "Sin dato";
  }

  const item = value as { name?: unknown };

  return item.name ? String(item.name) : "Sin dato";
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "company.created": "Empresa creada",
    "company.updated": "Empresa actualizada",
    "company.attendance_rules.updated": "Reglas asistencia",
    "document.created": "Documento creado",
    "document.updated": "Documento actualizado",
    "employee_request.created": "Solicitud creada",
    "employee.attendance_pin.updated": "PIN marcacion",
    "employee.attendance_pin.self_updated": "PIN personal",
    "employee.created": "Trabajador creado",
    "employee.updated": "Trabajador actualizado",
    "employee_request.approved": "Solicitud aprobada",
    "employee_request.rejected": "Solicitud rechazada",
    "attendance.created": "Asistencia creada",
    "attendance.updated": "Asistencia actualizada",
    "role.created": "Rol creado",
    "role.updated": "Rol actualizado",
    "user.created": "Usuario creado",
    "user.updated": "Usuario actualizado",
  };

  return labels[action] ?? action;
}

function actorTypeLabel(actorType: string) {
  const labels: Record<string, string> = {
    system: "Sistema",
    user: "Usuario",
    worker: "Trabajador",
  };

  return labels[actorType] ?? actorType;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
