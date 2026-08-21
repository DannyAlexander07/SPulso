import { getCompanies } from "@/features/companies/api";
import { getCurrentUser } from "@/features/auth/api";
import { getEmployeesPage } from "@/features/employees/api";
import { EmployeesView } from "@/features/employees/employees-view";
import type { EmployeeFilters } from "@/features/employees/types";
import { getOrganization } from "@/features/organization/api";
import { getServerToken } from "@/lib/server-auth";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    buscar?: string;
    cursor?: string;
    empresa?: string;
    estado?: string;
    pagina?: string;
    porPagina?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const token = await getServerToken();
  const [companies, currentUser, employeesPage, organization] =
    await Promise.all([
      getCompanies(undefined, token),
      getCurrentUser(token),
      getEmployeesPage(filters, token),
      getOrganization(filters.companyId, token),
    ]);

  return (
    <EmployeesView
      companies={companies}
      currentUser={currentUser}
      employees={employeesPage.data}
      filters={filters}
      organization={organization}
      pagination={employeesPage.meta}
    />
  );
}

function normalizeFilters(params?: {
  buscar?: string;
  cursor?: string;
  empresa?: string;
  estado?: string;
  pagina?: string;
  porPagina?: string;
}) {
  const filters: EmployeeFilters = {};
  const statusValues = ["ACTIVE", "INACTIVE", "TERMINATED"];
  const page = Number(params?.pagina ?? 1);
  const pageSize = Number(params?.porPagina ?? 10);

  if (params?.buscar?.trim()) {
    filters.search = params.buscar.trim();
  }

  if (params?.cursor?.trim()) {
    filters.cursor = params.cursor.trim();
  }

  if (params?.empresa?.trim()) {
    filters.companyId = params.empresa.trim();
  }

  if (params?.estado && statusValues.includes(params.estado)) {
    filters.status = params.estado as EmployeeFilters["status"];
  }

  filters.page = Number.isInteger(page) && page > 0 ? page : 1;
  filters.pageSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? Math.min(Math.max(pageSize, 5), 100)
      : 10;

  return filters;
}
