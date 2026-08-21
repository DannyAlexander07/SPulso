import { getCurrentUser } from "@/features/auth/api";
import { getCompanies } from "@/features/companies/api";
import { getOrganization } from "@/features/organization/api";
import { getRoles, getUsersPage } from "@/features/users/api";
import type { UserFilters } from "@/features/users/types";
import { UsersView } from "@/features/users/users-view";
import { getServerToken } from "@/lib/server-auth";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<{
    buscar?: string;
    empresa?: string;
    estado?: string;
    pagina?: string;
    porPagina?: string;
    rol?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const token = await getServerToken();

  const [companies, currentUser, organization, roles, usersPage] = await Promise.all([
    getCompanies(undefined, token),
    getCurrentUser(token),
    getOrganization(undefined, token),
    getRoles(token),
    getUsersPage(filters, token),
  ]);

  return (
    <UsersView
      companies={companies}
      currentUser={currentUser}
      filters={filters}
      organization={organization}
      pagination={usersPage.meta}
      roles={roles}
      users={usersPage.data}
    />
  );
}

function normalizeFilters(params?: {
  buscar?: string;
  empresa?: string;
  estado?: string;
  pagina?: string;
  porPagina?: string;
  rol?: string;
}) {
  const filters: UserFilters = {};
  const statusValues = ["INVITED", "ACTIVE", "INACTIVE"];
  const page = Number(params?.pagina ?? 1);
  const pageSize = Number(params?.porPagina ?? 10);

  if (params?.buscar?.trim()) {
    filters.search = params.buscar.trim();
  }

  if (params?.rol?.trim()) {
    filters.roleId = params.rol.trim();
  }

  if (params?.empresa?.trim()) {
    filters.companyId = params.empresa.trim();
  }

  if (params?.estado && statusValues.includes(params.estado)) {
    filters.status = params.estado as UserFilters["status"];
  }

  filters.page = Number.isInteger(page) && page > 0 ? page : 1;
  filters.pageSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(Math.max(pageSize, 5), 100) : 10;

  return filters;
}
