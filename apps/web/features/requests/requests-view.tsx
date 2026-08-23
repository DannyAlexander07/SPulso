import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileX2,
  Sparkles,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/surface";
import {
  canCreateRequests,
  canManageRequests,
} from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import type { Employee } from "@/features/employees/types";
import { CreateRequestForm } from "./create-request-form";
import { RequestActions } from "./request-actions";
import { RequestFiltersForm } from "./request-filters";
import { RequestsExportButton } from "./requests-export-button";
import type {
  EmployeeRequest,
  RequestFilters,
  RequestsPagination,
  RequestsSummary,
} from "./types";

export function RequestsView({
  companies,
  employees,
  currentUser,
  filters,
  pagination,
  requests,
  summary,
}: {
  companies: Company[];
  employees: Employee[];
  currentUser: AuthUser | null;
  filters: RequestFilters;
  pagination: RequestsPagination;
  requests: EmployeeRequest[];
  summary: RequestsSummary;
}) {
  const canCreate = canCreateRequests(currentUser);
  const canDecide = canManageRequests(currentUser);
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/solicitudes" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar
            currentUser={currentUser}
            eyebrow="Solicitudes"
            title="Flujo de aprobaciones"
          />

          <div className="w-full px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 md:grid-cols-4">
              <MetricCard
                icon={Clock3}
                label="Pendientes"
                tone="warning"
                value={summary.pending.toString()}
              />
              <MetricCard
                icon={CheckCircle2}
                label="Aprobadas"
                tone="success"
                value={summary.approved.toString()}
              />
              <MetricCard
                icon={FileX2}
                label="Rechazadas"
                tone="danger"
                value={summary.rejected.toString()}
              />
              <MetricCard
                icon={FileCheck2}
                label="Total"
                value={summary.total.toString()}
              />
            </section>

            <CrudSection
              actions={
                <>
                  <RequestsExportButton
                    filters={filters}
                    total={pagination.total ?? requests.length}
                  />
                  {canCreate ? (
                    <CreateRequestForm employees={employees} />
                  ) : null}
                </>
              }
              className="mt-3"
              description={
                <>
                  Vacaciones, permisos, remoto, descanso medico y decisiones
                  pendientes.{" "}
                  {requests.length > 0
                    ? paginationLabel(pagination, requests.length)
                    : "Sin resultados."}
                </>
              }
              eyebrow="Bandeja"
              filters={
                <RequestFiltersForm
                  companies={companies}
                  employees={employees}
                  filters={filters}
                />
              }
              title="Solicitudes recientes"
            >
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {requests.length > 0 ? (
                  requests.map((request, index) => (
                    <RequestCard
                      canDecide={canDecide}
                      index={index}
                      key={request.id}
                      request={request}
                    />
                  ))
                ) : (
                  <div className="lg:col-span-3">
                    <EmptyState
                      description="Cambia filtros o registra una nueva solicitud para verla aqui."
                      icon={Clock3}
                      title="No hay solicitudes con los filtros seleccionados"
                    />
                  </div>
                )}
              </div>

              <RequestsPaginationControls
                filters={filters}
                pagination={pagination}
              />
            </CrudSection>
          </div>
        </section>
      </div>
    </main>
  );
}

function RequestsPaginationControls({
  filters,
  pagination,
}: {
  filters: RequestFilters;
  pagination: RequestsPagination;
}) {
  return (
    <CursorPagination
      className="mt-5"
      firstHref={`/solicitudes?${buildPaginationQuery(filters)}`}
      hasNextPage={pagination.hasNextPage}
      nextHref={`/solicitudes?${buildPaginationQuery(filters, pagination.nextCursor ?? undefined)}`}
      totalLabel={cursorLabel(
        "solicitudes",
        filters.cursor,
        pagination.hasNextPage,
      )}
    />
  );
}

function buildPaginationQuery(filters: RequestFilters, cursor?: string) {
  const query = new URLSearchParams();

  if (filters.search) {
    query.set("buscar", filters.search);
  }

  if (filters.companyId) {
    query.set("empresa", filters.companyId);
  }

  if (filters.employeeId) {
    query.set("trabajador", filters.employeeId);
  }

  if (filters.status) {
    query.set("estado", filters.status);
  }

  if (filters.type) {
    query.set("tipo", filters.type);
  }

  if (cursor) {
    query.set("cursor", cursor);
  }

  query.set("porPagina", String(filters.pageSize ?? 10));

  return query.toString();
}

function paginationLabel(pagination: RequestsPagination, visibleCount: number) {
  if (pagination.total === null || pagination.totalPages === null) {
    return `Mostrando ${visibleCount} solicitudes${pagination.hasNextPage ? " · hay mas resultados" : ""}`;
  }

  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return `Mostrando ${start}-${end} de ${pagination.total}`;
}

function cursorLabel(
  noun: string,
  cursor: string | undefined,
  hasNextPage: boolean,
) {
  if (cursor) {
    return hasNextPage
      ? `Pagina cargada · hay mas ${noun}`
      : `Ultima pagina de ${noun}`;
  }

  return hasNextPage
    ? `Primeras ${noun} cargadas · hay mas resultados`
    : `Todas las ${noun} filtradas estan visibles`;
}

function RequestCard({
  canDecide,
  index,
  request,
}: {
  canDecide: boolean;
  index: number;
  request: EmployeeRequest;
}) {
  const status = {
    PENDING: { label: "Pendiente", tone: "warning" as const },
    APPROVED: { label: "Aprobada", tone: "success" as const },
    REJECTED: { label: "Rechazada", tone: "danger" as const },
    CANCELLED: { label: "Cancelada", tone: "neutral" as const },
  }[request.status];

  const typeLabel = {
    VACATION: "Vacaciones",
    PERMISSION: "Permiso",
    REMOTE_WORK: "Trabajo remoto",
    MEDICAL_LEAVE: "Descanso medico",
    OTHER: "Otro",
  }[request.type];

  return (
    <article
      className="animate-rise flex min-h-[306px] flex-col rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#b9c5d6] hover:bg-white hover:shadow-[0_16px_34px_rgba(16,24,40,0.065)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-sm font-semibold leading-5">
            {request.title}
          </p>
          <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">
            {typeLabel}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="mt-4 rounded-xl bg-white p-3">
        <p className="whitespace-normal break-words text-sm font-semibold leading-5">
          {request.employee.firstName} {request.employee.lastName}
        </p>
        <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">
          {request.employee.jobTitle ?? "Sin cargo"} · {request.company.name}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[#667085]">
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
          <CalendarDays className="h-3.5 w-3.5 text-[#4f46e5]" />
          <span className="min-w-0 break-words">
            {formatDateRange(request.startDate, request.endDate)}
          </span>
        </div>
        {affectsAttendance(request.type) ? (
          <div className="flex items-center gap-2 rounded-xl bg-[#eef2ff] px-3 py-2 font-semibold text-[#4f46e5]">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="min-w-0 break-words">
              Al aprobar, se marca como permiso en asistencia.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 text-[#98a2b3]" />
            <span className="min-w-0 break-words">
              No cambia la asistencia automaticamente.
            </span>
          </div>
        )}
      </div>
      <div className="mt-auto pt-3">
        {canDecide && request.status === "PENDING" ? (
          <RequestActions request={request} />
        ) : null}
      </div>
    </article>
  );
}

function affectsAttendance(type: EmployeeRequest["type"]) {
  return (
    type === "VACATION" || type === "PERMISSION" || type === "MEDICAL_LEAVE"
  );
}

function formatDateRange(startDate: string, endDate: string | null) {
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : start;

  return start === end ? start : `${start} - ${end}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
