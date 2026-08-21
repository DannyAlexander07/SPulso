import { getCompanies } from "@/features/companies/api";
import { getEmployeesPage } from "@/features/employees/api";
import { getCurrentUser } from "@/features/auth/api";
import {
  getDocumentsPage,
  getDocumentFolders,
  getDocumentsSummary,
} from "@/features/documents/api";
import { DocumentsView } from "@/features/documents/documents-view";
import type { DocumentFilters } from "@/features/documents/types";
import { getServerToken } from "@/lib/server-auth";

export default async function DocumentosPage({
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
    vista?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const token = await getServerToken();
  const [companies, currentUser, documentsPage, employees, folders, summary] =
    await Promise.all([
      getCompanies(undefined, token),
      getCurrentUser(token),
      getDocumentsPage(filters, token),
      getEmployeesPage({ pageSize: 20, status: "ACTIVE" }, token).then(
        (result) => result.data,
      ),
      getDocumentFolders(token),
      getDocumentsSummary(token),
    ]);

  return (
    <DocumentsView
      companies={companies}
      documents={documentsPage.data}
      currentUser={currentUser}
      employees={employees}
      filters={filters}
      folders={folders}
      pagination={documentsPage.meta}
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
    carpeta?: string;
    vista?: string;
}) {
  const filters: DocumentFilters = {};
  const statusValues = ["DRAFT", "PENDING_SIGNATURE", "SIGNED", "EXPIRED"];
  const typeValues = ["CONTRACT", "PAYSLIP", "POLICY", "CERTIFICATE", "OTHER"];
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

  if (params?.carpeta?.trim()) {
    filters.folderId = params.carpeta.trim();
  }

  if (params?.estado && statusValues.includes(params.estado)) {
    filters.status = params.estado as DocumentFilters["status"];
  }

  if (params?.tipo && typeValues.includes(params.tipo)) {
    filters.type = params.tipo as DocumentFilters["type"];
  }

  filters.view = params?.vista === "carpeta" ? "folder" : "employee";

  filters.page = Number.isInteger(page) && page > 0 ? page : 1;
  filters.pageSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? Math.min(Math.max(pageSize, 5), 100)
      : 10;

  return filters;
}
