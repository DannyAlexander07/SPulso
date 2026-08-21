import { AuditView } from "@/features/audit/audit-view";
import { getAuditLogsPage } from "@/features/audit/api";
import type { AuditFilters } from "@/features/audit/types";
import { getCurrentUser } from "@/features/auth/api";
import { getCompanies } from "@/features/companies/api";
import { getServerToken } from "@/lib/server-auth";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams?: Promise<{
    actor?: string;
    buscar?: string;
    cursor?: string;
    desde?: string;
    empresa?: string;
    hasta?: string;
    pagina?: string;
    porPagina?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const token = await getServerToken();
  const [companies, currentUser, logsPage] = await Promise.all([
    getCompanies(undefined, token),
    getCurrentUser(token),
    getAuditLogsPage(filters, token),
  ]);

  return (
    <AuditView
      companies={companies}
      currentUser={currentUser}
      filters={filters}
      logs={logsPage.data}
      pagination={logsPage.meta}
    />
  );
}

function normalizeFilters(params?: {
  actor?: string;
  buscar?: string;
  cursor?: string;
  desde?: string;
  empresa?: string;
  hasta?: string;
  pagina?: string;
  porPagina?: string;
}) {
  const filters: AuditFilters = {};
  const actorValues = ["system", "user", "worker"];
  const page = Number(params?.pagina ?? 1);
  const pageSize = Number(params?.porPagina ?? 20);

  if (params?.buscar?.trim()) {
    filters.search = params.buscar.trim();
  }

  if (params?.cursor?.trim()) {
    filters.cursor = params.cursor.trim();
  }

  if (params?.empresa?.trim()) {
    filters.companyId = params.empresa.trim();
  }

  if (params?.desde && /^\d{4}-\d{2}-\d{2}$/.test(params.desde)) {
    filters.from = params.desde;
  }

  if (params?.hasta && /^\d{4}-\d{2}-\d{2}$/.test(params.hasta)) {
    filters.to = params.hasta;
  }

  if (params?.actor && actorValues.includes(params.actor)) {
    filters.actorType = params.actor;
  }

  filters.page = Number.isInteger(page) && page > 0 ? page : 1;
  filters.pageSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? Math.min(Math.max(pageSize, 10), 100)
      : 20;

  return filters;
}
