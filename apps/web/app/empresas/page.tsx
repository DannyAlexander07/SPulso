import { getCompanies } from "@/features/companies/api";
import { CompaniesView } from "@/features/companies/companies-view";
import type { CompanyFilters } from "@/features/companies/types";
import { getCurrentUser } from "@/features/auth/api";
import { getServerToken } from "@/lib/server-auth";

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams?: Promise<{ buscar?: string; estado?: string }>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const token = await getServerToken();
  const [companies, currentUser] = await Promise.all([
    getCompanies(filters, token),
    getCurrentUser(token),
  ]);

  return <CompaniesView companies={companies} currentUser={currentUser} filters={filters} />;
}

function normalizeFilters(params?: { buscar?: string; estado?: string }) {
  const filters: CompanyFilters = {};
  const statusValues = ["ACTIVE", "INACTIVE"];

  if (params?.buscar?.trim()) {
    filters.search = params.buscar.trim();
  }

  if (params?.estado && statusValues.includes(params.estado)) {
    filters.status = params.estado as CompanyFilters["status"];
  }

  return filters;
}
