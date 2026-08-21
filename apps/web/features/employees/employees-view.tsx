import Link from "next/link";
import {
  BriefcaseBusiness,
  Building2,
  Eye,
  IdCard,
  Network,
  ShieldCheck,
  UserX,
  UsersRound,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
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
import { MetricCard } from "@/components/ui/surface";
import { canManageEmployees } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import { CreateEmployeeForm } from "./create-employee-form";
import { EmployeeRowActions } from "./employee-row-actions";
import { EmployeeFiltersForm } from "./employee-filters";
import { EmployeesExportButton } from "./employees-export-button";
import type { Employee, EmployeeFilters, EmployeesPagination } from "./types";
import type { OrganizationData } from "@/features/organization/types";
import { mediaUrl } from "@/lib/api";

export function EmployeesView({
  companies,
  currentUser,
  employees,
  filters,
  organization,
  pagination,
}: {
  companies: Company[];
  currentUser: AuthUser | null;
  employees: Employee[];
  filters: EmployeeFilters;
  organization: OrganizationData;
  pagination: EmployeesPagination;
}) {
  const canManage = canManageEmployees(currentUser);
  const linkedCompanies = new Set(
    employees.map((employee) => employee.company.name),
  );
  const areas = new Set(
    employees
      .map((employee) => employee.areaRef?.name ?? employee.area)
      .filter(Boolean),
  );

  return (
    <main className="spulso-employees-module min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/trabajadores" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar
            currentUser={currentUser}
            eyebrow="Trabajadores"
            title="Directorio de personas"
          />

          <div className="mx-auto max-w-[1500px] px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 md:grid-cols-3">
              <MetricCard
                icon={UsersRound}
                label="Trabajadores encontrados"
                value={
                  pagination.total?.toString() ?? employees.length.toString()
                }
              />
              <MetricCard
                icon={Building2}
                label="Empresas en esta vista"
                tone="success"
                value={linkedCompanies.size.toString()}
              />
              <MetricCard
                icon={BriefcaseBusiness}
                label="Areas en esta vista"
                tone="warning"
                value={areas.size.toString()}
              />
            </section>

            <CrudSection
              actions={
                <>
                  <EmployeesExportButton
                    filters={filters}
                    total={pagination.total ?? employees.length}
                  />
                  {canManage ? (
                    <CreateEmployeeForm
                      companies={companies}
                      organization={organization}
                    />
                  ) : null}
                </>
              }
              className="mt-3"
              description={
                <>
                  Busca, filtra, exporta y actualiza fichas por empresa, area,
                  cargo o estado.{" "}
                  {employees.length > 0
                    ? paginationLabel(pagination, employees.length)
                    : "Sin resultados."}
                </>
              }
              eyebrow="Equipo"
              filters={
                <EmployeeFiltersForm companies={companies} filters={filters} />
              }
              title="Trabajadores registrados"
            >
              <DataTable
                className="spulso-employee-table"
                tableClassName="min-w-[1280px]"
              >
                <DataTableHead>
                  <DataTableHeader className="w-[240px]">
                    Trabajador
                  </DataTableHeader>
                  <DataTableHeader className="w-[130px]">
                    Empresa
                  </DataTableHeader>
                  <DataTableHeader className="w-[210px]">
                    Organizacion
                  </DataTableHeader>
                  <DataTableHeader className="w-[180px]">
                    Equipo
                  </DataTableHeader>
                  <DataTableHeader className="w-[95px]">Codigo</DataTableHeader>
                  <DataTableHeader align="center" className="w-[110px]">
                    Estado
                  </DataTableHeader>
                  {canManage ? (
                    <DataTableHeader
                      align="right"
                      className="spulso-employee-sticky-header sticky right-0 z-10 w-[220px]"
                    >
                      Acciones
                    </DataTableHeader>
                  ) : null}
                </DataTableHead>
                <tbody>
                  {employees.length > 0 ? (
                    employees.map((employee, index) => (
                      <EmployeeRow
                        canManage={canManage}
                        companies={companies}
                        employee={employee}
                        index={index}
                        organization={organization}
                        key={employee.id}
                      />
                    ))
                  ) : (
                    <tr>
                      <DataTableCell colSpan={canManage ? 7 : 6}>
                        <EmptyState
                          description="Ajusta la busqueda, cambia empresa o limpia filtros para ver mas resultados."
                          icon={UsersRound}
                          title="No hay trabajadores con los filtros seleccionados"
                        />
                      </DataTableCell>
                    </tr>
                  )}
                </tbody>
              </DataTable>

              <EmployeesPaginationControls
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

function EmployeesPaginationControls({
  filters,
  pagination,
}: {
  filters: EmployeeFilters;
  pagination: EmployeesPagination;
}) {
  return (
    <CursorPagination
      className="mt-5"
      firstHref={`/trabajadores?${buildPaginationQuery(filters)}`}
      hasNextPage={pagination.hasNextPage}
      nextHref={`/trabajadores?${buildPaginationQuery(filters, pagination.nextCursor ?? undefined)}`}
      totalLabel={employeesTotalLabel(
        pagination,
        filters,
        pagination.hasNextPage,
      )}
    />
  );
}

function buildPaginationQuery(filters: EmployeeFilters, cursor?: string) {
  const query = new URLSearchParams();

  if (filters.search) {
    query.set("buscar", filters.search);
  }

  if (filters.companyId) {
    query.set("empresa", filters.companyId);
  }

  if (filters.status) {
    query.set("estado", filters.status);
  }

  if (cursor) {
    query.set("cursor", cursor);
  }

  query.set("porPagina", String(filters.pageSize ?? 10));

  return query.toString();
}

function paginationLabel(
  pagination: EmployeesPagination,
  visibleCount: number,
) {
  if (pagination.total === null || pagination.totalPages === null) {
    return `Mostrando ${visibleCount} trabajadores${pagination.hasNextPage ? " · hay mas resultados" : ""}`;
  }

  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return `Mostrando ${start}-${end} de ${pagination.total}`;
}

function employeesTotalLabel(
  pagination: EmployeesPagination,
  filters: EmployeeFilters,
  hasNextPage: boolean,
) {
  if (pagination.total !== null) {
    return pagination.total > 0
      ? paginationLabel(pagination, pagination.pageSize)
      : "No hay trabajadores para mostrar.";
  }

  return filters.cursor
    ? hasNextPage
      ? "Pagina cargada · hay mas trabajadores"
      : "Ultima pagina de trabajadores"
    : hasNextPage
      ? "Primeros trabajadores cargados · hay mas resultados"
      : "Todos los trabajadores filtrados estan visibles";
}

function EmployeeRow({
  canManage,
  companies,
  employee,
  index,
  organization,
}: {
  canManage: boolean;
  companies: Company[];
  employee: Employee;
  index: number;
  organization: OrganizationData;
}) {
  const initials =
    `${employee.firstName.slice(0, 1)}${employee.lastName.slice(0, 1)}`.toUpperCase();
  const status = {
    ACTIVE: {
      icon: ShieldCheck,
      label: "Activo",
      tone: "success" as const,
    },
    INACTIVE: {
      icon: UserX,
      label: "Inactivo",
      tone: "neutral" as const,
    },
    TERMINATED: {
      icon: UserX,
      label: "Cesado",
      tone: "danger" as const,
    },
  }[employee.status];
  const StatusIcon = status.icon;

  return (
    <tr
      className="spulso-employee-row animate-rise border-t border-[#e1e5eb] text-sm transition"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <DataTableCell>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef2ff] text-xs font-bold text-[#4f46e5] shadow-sm">
            {employee.user?.avatarUrl ? (
              <img
                alt={`${employee.firstName} ${employee.lastName}`}
                className="h-full w-full rounded-[14px] object-cover"
                src={mediaUrl(employee.user.avatarUrl)}
              />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0">
            <p className="whitespace-normal break-words font-semibold leading-5 text-[#1f242d]">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="mt-0.5 flex items-center gap-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">
              <IdCard className="h-3.5 w-3.5" />
              DNI {employee.documentNumber ?? "Sin documento"}
            </p>
            <Link
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#4f46e5] transition hover:text-[#4338ca]"
              href={`/trabajadores/${employee.id}`}
            >
              <Eye className="h-3.5 w-3.5" />
              Ver perfil
            </Link>
          </div>
        </div>
      </DataTableCell>
      <DataTableCell>
        <span className="inline-flex max-w-[200px] items-start gap-1.5 rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold leading-4 text-[#4f46e5]">
          <Building2 className="h-3.5 w-3.5" />
          <span className="min-w-0 whitespace-normal break-words">
            {employee.company.name}
          </span>
        </span>
      </DataTableCell>
      <DataTableCell>
        <div className="max-w-[270px]">
          <p className="whitespace-normal break-words font-semibold leading-5 text-[#344054]">
            {employee.position?.name ?? employee.jobTitle ?? "Sin cargo"}
          </p>
          <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">
            {employee.areaRef?.name ?? employee.area ?? "Sin area"}
          </p>
          {employee.manager ? (
            <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">
              Jefe: {employee.manager.firstName} {employee.manager.lastName}
            </p>
          ) : null}
          {employee.status === "TERMINATED" && employee.terminationReason ? (
            <p className="mt-1 whitespace-normal break-words text-xs font-semibold leading-4 text-[#b42318]">
              Cese: {employee.terminationReason}
            </p>
          ) : null}
        </div>
      </DataTableCell>
      <DataTableCell>
        <span className="inline-flex max-w-[230px] items-start gap-1.5 rounded-full bg-[#f8fafc] px-2.5 py-1 text-xs font-semibold leading-4 text-[#475467]">
          <Network className="h-3.5 w-3.5 shrink-0 text-[#667085]" />
          <span className="min-w-0 whitespace-normal break-words">
            {employee.team?.name ?? "Sin equipo"}
          </span>
        </span>
      </DataTableCell>
      <DataTableCell>
        <span className="rounded-lg bg-[#f3f5f8] px-2.5 py-1 text-xs font-bold text-[#667085]">
          {employee.employeeCode ?? "N/A"}
        </span>
      </DataTableCell>
      <DataTableCell align="center">
        <Badge className="gap-1.5" tone={status.tone}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </Badge>
      </DataTableCell>
      {canManage ? (
        <DataTableCell
          align="right"
          className="spulso-employee-sticky-cell sticky right-0 z-10 w-[220px] whitespace-nowrap"
        >
          <EmployeeRowActions
            companies={companies}
            employee={employee}
            organization={organization}
          />
        </DataTableCell>
      ) : null}
    </tr>
  );
}
