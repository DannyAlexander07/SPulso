import { KeyRound, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { DataTable, DataTableCell, DataTableHead, DataTableHeader } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { MetricCard } from "@/components/ui/surface";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import type { OrganizationData } from "@/features/organization/types";
import { mediaUrl } from "@/lib/api";
import { CreateUserForm } from "./create-user-form";
import { RolesManagementPanel } from "./roles-management-panel";
import { UserRowActions } from "./user-row-actions";
import { UserFiltersForm } from "./user-filters";
import { UsersExportButton } from "./users-export-button";
import type { AppRole, AppUser, UserFilters, UsersPagination } from "./types";

export function UsersView({
  companies,
  currentUser,
  filters,
  organization,
  pagination,
  roles,
  users,
}: {
  companies: Company[];
  currentUser: AuthUser | null;
  filters: UserFilters;
  organization: OrganizationData;
  pagination: UsersPagination;
  roles: AppRole[];
  users: AppUser[];
}) {
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/usuarios" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Usuarios" title="Roles y accesos" />

          <div className="w-full px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 md:grid-cols-3">
              <MetricCard icon={UsersRound} label="Usuarios filtrados" value={pagination.total.toString()} />
              <MetricCard icon={ShieldCheck} label="Roles disponibles" tone="success" value={roles.length.toString()} />
              <MetricCard icon={KeyRound} label="Control de accesos" tone="warning" value="Activo" />
            </section>

            <CrudSection
              actions={
                <>
                  <UsersExportButton filters={filters} total={pagination.total} />
                  <CreateUserForm companies={companies} organization={organization} roles={roles} />
                </>
              }
              className="mt-3"
              description={
                <>
                  Administra accesos, roles, empresas asociadas y estado de cada usuario.{" "}
                  {pagination.total > 0 ? paginationLabel(pagination) : "Sin resultados."}
                </>
              }
              eyebrow="Directorio"
              filters={<UserFiltersForm companies={companies} filters={filters} roles={roles} />}
              title="Usuarios del sistema"
            >
              <DataTable tableClassName="min-w-[1180px]">
                <DataTableHead>
                  <DataTableHeader>Usuario</DataTableHeader>
                  <DataTableHeader>Rol</DataTableHeader>
                  <DataTableHeader>Acceso empresa</DataTableHeader>
                  <DataTableHeader>Creado</DataTableHeader>
                  <DataTableHeader align="right">Estado</DataTableHeader>
                  <DataTableHeader align="right" className="w-[210px]">Acciones</DataTableHeader>
                </DataTableHead>
                  <tbody>
                    {users.length > 0 ? (
                      users.map((user, index) => (
                        <UserRow
                          companies={companies}
                          currentUser={currentUser}
                          index={index}
                          organization={organization}
                          key={user.id}
                          roles={roles}
                          user={user}
                        />
                      ))
                    ) : (
                      <tr>
                        <DataTableCell colSpan={6}>
                          <EmptyState
                            description="Ajusta los filtros o crea un nuevo usuario administrativo."
                            icon={UsersRound}
                            title="No hay usuarios con los filtros seleccionados"
                          />
                        </DataTableCell>
                      </tr>
                    )}
                  </tbody>
              </DataTable>

              <UsersPaginationControls filters={filters} pagination={pagination} />
            </CrudSection>

            <RolesManagementPanel currentUser={currentUser} roles={roles} />
          </div>
        </section>
      </div>
    </main>
  );
}

function UsersPaginationControls({
  filters,
  pagination,
}: {
  filters: UserFilters;
  pagination: UsersPagination;
}) {
  return (
    <Pagination
      buildHref={(page) => `/usuarios?${buildPaginationQuery(filters, page)}`}
      className="mt-5"
      page={pagination.page}
      totalLabel={pagination.total > 0 ? paginationLabel(pagination) : "No hay usuarios para mostrar."}
      totalPages={pagination.totalPages}
    />
  );
}

function buildPaginationQuery(filters: UserFilters, page: number) {
  const query = new URLSearchParams();

  if (filters.search) {
    query.set("buscar", filters.search);
  }

  if (filters.roleId) {
    query.set("rol", filters.roleId);
  }

  if (filters.companyId) {
    query.set("empresa", filters.companyId);
  }

  if (filters.status) {
    query.set("estado", filters.status);
  }

  query.set("pagina", String(page));
  query.set("porPagina", String(filters.pageSize ?? 10));

  return query.toString();
}

function paginationLabel(pagination: UsersPagination) {
  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return `Mostrando ${start}-${end} de ${pagination.total}`;
}

function UserRow({
  companies,
  currentUser,
  index,
  organization,
  roles,
  user,
}: {
  companies: Company[];
  currentUser: AuthUser | null;
  index: number;
  organization: OrganizationData;
  roles: AppRole[];
  user: AppUser;
}) {
  const initials = `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase();
  const status = statusMeta(user.status);

  return (
    <tr className="animate-rise text-sm transition hover:bg-[#f8fafc]" style={{ animationDelay: `${index * 45}ms` }}>
      <td className="border-t border-[#e1e5eb] px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef2ff] text-xs font-bold text-[#4f46e5] shadow-sm">
            {user.avatarUrl ? (
              <img alt={`${user.firstName} ${user.lastName}`} className="h-full w-full rounded-[14px] object-cover" src={mediaUrl(user.avatarUrl)} />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0">
            <p className="whitespace-normal break-words font-semibold leading-5 text-[#1f242d]">
              {user.firstName} {user.lastName}
            </p>
            <p className="mt-0.5 whitespace-normal break-all text-xs leading-4 text-[#667085]">{user.email}</p>
          </div>
        </div>
      </td>
      <DataTableCell>
        <span className="inline-flex max-w-[220px] items-start gap-1.5 rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold leading-4 text-[#4f46e5]">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="min-w-0 whitespace-normal break-words">{user.role?.name ?? "Sin rol"}</span>
        </span>
      </DataTableCell>
      <DataTableCell>
        <span className="inline-flex max-w-[220px] items-start gap-1.5 rounded-full bg-[#f8fafc] px-2.5 py-1 text-xs font-semibold leading-4 text-[#475467]">
          <UserCheck className="h-3.5 w-3.5 text-[#667085]" />
          <span className="min-w-0 whitespace-normal break-words">{user.company?.name ?? "Grupo completo"}</span>
        </span>
      </DataTableCell>
      <DataTableCell className="text-[#475467]">
        {formatDate(user.createdAt)}
      </DataTableCell>
      <DataTableCell align="right">
        <Badge tone={status.tone}>{status.label}</Badge>
      </DataTableCell>
      <DataTableCell align="right" className="w-[210px]">
        <UserRowActions
          companies={companies}
          currentUser={currentUser}
          organization={organization}
          roles={roles}
          user={user}
        />
      </DataTableCell>
    </tr>
  );
}

function statusMeta(status: AppUser["status"]) {
  const labels = {
    ACTIVE: { label: "Activo", tone: "success" as const },
    INVITED: { label: "Invitado", tone: "warning" as const },
    INACTIVE: { label: "Inactivo", tone: "danger" as const },
  };

  return labels[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
