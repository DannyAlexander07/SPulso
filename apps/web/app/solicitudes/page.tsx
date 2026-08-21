import { getCompanies } from "@/features/companies/api";
import { getEmployees } from "@/features/employees/api";
import { getCurrentUser } from "@/features/auth/api";
import { getRequestsPage, getRequestsSummary } from "@/features/requests/api";
import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/types";
import { getServerToken } from "@/lib/server-auth";

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    buscar?: string;
    cursor?: string;
    empresa?: string;
    estado?: string;
    pagina?: string;
    porPagina?: string;
    tipo?: string;
    trabajador?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const token = await getServerToken();
  const [companies, currentUser, employees, requestsPage, summary] =
    await Promise.all([
      getCompanies(undefined, token),
      getCurrentUser(token),
      getEmployees(undefined, token),
      getRequestsPage(filters, token),
      getRequestsSummary(token),
    ]);

  return (
    <RequestsView
      companies={companies}
      employees={employees}
      currentUser={currentUser}
      filters={filters}
      pagination={requestsPage.meta}
      requests={requestsPage.data}
      summary={summary}
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
  tipo?: string;
  trabajador?: string;
}) {
  const filters: RequestFilters = {};
  const statusValues = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
  const typeValues = [
    "VACATION",
    "PERMISSION",
    "REMOTE_WORK",
    "MEDICAL_LEAVE",
    "OTHER",
  ];
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

  if (params?.trabajador?.trim()) {
    filters.employeeId = params.trabajador.trim();
  }

  if (params?.estado && statusValues.includes(params.estado)) {
    filters.status = params.estado as RequestFilters["status"];
  }

  if (params?.tipo && typeValues.includes(params.tipo)) {
    filters.type = params.tipo as RequestFilters["type"];
  }

  filters.page = Number.isInteger(page) && page > 0 ? page : 1;
  filters.pageSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? Math.min(Math.max(pageSize, 5), 100)
      : 10;

  return filters;
}
