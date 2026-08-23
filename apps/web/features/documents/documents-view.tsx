import {
  Building2,
  CalendarDays,
  FileCheck2,
  FilePenLine,
  FileText,
  FileWarning,
  FolderOpen,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/surface";
import { canManageDocuments } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import { formatCalendarDate } from "@/lib/date";
import type { Company } from "@/features/companies/types";
import type { Employee } from "@/features/employees/types";
import { CreateDocumentForm } from "./create-document-form";
import { DocumentFilePreview } from "./document-file-preview";
import { DocumentFolderActions } from "./document-folder-actions";
import { DocumentFolderForm } from "./document-folder-form";
import { DocumentFiltersForm } from "./document-filters";
import { DocumentRowActions } from "./document-row-actions";
import { DocumentsExportButton } from "./documents-export-button";
import type {
  DocumentFilters,
  DocumentFolder,
  DocumentsPagination,
  DocumentsSummary,
  EmployeeDocument,
} from "./types";

export function DocumentsView({
  companies,
  documents,
  currentUser,
  employees,
  filters,
  folders,
  pagination,
  summary,
}: {
  companies: Company[];
  documents: EmployeeDocument[];
  currentUser: AuthUser | null;
  employees: Employee[];
  filters: DocumentFilters;
  folders: DocumentFolder[];
  pagination: DocumentsPagination;
  summary: DocumentsSummary;
}) {
  const canManage = canManageDocuments(currentUser);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/documentos" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar
            currentUser={currentUser}
            eyebrow="Documentos"
            title="Gestion documental"
          />

          <div className="mx-auto max-w-[1500px] px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 md:grid-cols-4">
              <MetricCard
                icon={FileText}
                label="Total"
                value={summary.total.toString()}
              />
              <MetricCard
                icon={FileCheck2}
                label="Firmados"
                tone="success"
                value={summary.signed.toString()}
              />
              <MetricCard
                icon={FilePenLine}
                label="Pend. firma"
                tone="warning"
                value={summary.pendingSignature.toString()}
              />
              <MetricCard
                icon={FileWarning}
                label="Vencidos"
                tone="danger"
                value={summary.expired.toString()}
              />
            </section>

            <CrudSection
              actions={
                <>
                  <DocumentsExportButton
                    filters={filters}
                    total={pagination.total ?? documents.length}
                  />
                  {canManage ? (
                    <>
                      <DocumentFolderForm />
                      <CreateDocumentForm employees={employees} folders={folders} />
                    </>
                  ) : null}
                </>
              }
              className="mt-3"
              description={
                <>
                  Contratos, boletas, politicas, certificados, archivos y
                  vencimientos.{" "}
                  {documents.length > 0
                    ? paginationLabel(pagination, documents.length)
                    : "Sin resultados."}
                </>
              }
              eyebrow="Biblioteca"
              filters={
                <DocumentFiltersForm
                  companies={companies}
                  employees={employees}
                  filters={filters}
                  folders={folders}
                />
              }
              title="Documentos laborales"
            >
              <FolderOverview canManage={canManage} folders={folders} />
              <DocumentViewModeSwitch filters={filters} />
              {filters.view === "folder" ? (
                <FolderDocumentLibrary
                  canManage={canManage}
                  documents={documents}
                  employees={employees}
                />
              ) : (
                <EmployeeDocumentArchive
                  canManage={canManage}
                  documents={documents}
                  employees={employees}
                  folders={folders}
                />
              )}

              <DocumentsPaginationControls
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

function groupDocumentsByFolder(documents: EmployeeDocument[]) {
  const groups = new Map<string, EmployeeDocument[]>();

  for (const document of documents) {
    const folder = document.folderRef?.name ?? document.folder ?? "General";
    groups.set(folder, [...(groups.get(folder) ?? []), document]);
  }

  return Array.from(groups.entries()).map(([folder, items]) => ({
    folder,
    items,
  }));
}

function DocumentViewModeSwitch({ filters }: { filters: DocumentFilters }) {
  const currentView = filters.view ?? "employee";

  return (
    <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-[#dfe5ee] bg-[#fbfcfd] p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="px-2">
        <p className="text-sm font-semibold text-[#1f242d]">
          Archivo documental
        </p>
        <p className="text-xs leading-5 text-[#667085]">
          Navega por trabajador o por carpeta sin duplicar documentos.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:w-auto">
        <Link
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
            currentView === "employee"
              ? "bg-[#4f46e5] text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)]"
              : "border border-[#d8dee8] bg-white text-[#475467] hover:border-[#4f46e5] hover:text-[#4f46e5]"
          }`}
          href={`/documentos?${buildPaginationQuery({
            ...filters,
            cursor: undefined,
            view: "employee",
          })}`}
        >
          <UserRound className="h-4 w-4" />
          Por trabajador
        </Link>
        <Link
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
            currentView === "folder"
              ? "bg-[#4f46e5] text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)]"
              : "border border-[#d8dee8] bg-white text-[#475467] hover:border-[#4f46e5] hover:text-[#4f46e5]"
          }`}
          href={`/documentos?${buildPaginationQuery({
            ...filters,
            cursor: undefined,
            view: "folder",
          })}`}
        >
          <FolderOpen className="h-4 w-4" />
          Por carpeta
        </Link>
      </div>
    </div>
  );
}

function FolderDocumentLibrary({
  canManage,
  documents,
  employees,
}: {
  canManage: boolean;
  documents: EmployeeDocument[];
  employees: Employee[];
}) {
  if (documents.length === 0) {
    return <DocumentsEmptyState />;
  }

  return (
    <div className="space-y-5">
      {groupDocumentsByFolder(documents).map((group) => (
        <section key={group.folder}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#344054]">
              {group.folder}
            </h3>
            <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
              {group.items.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.items.map((document, index) => (
              <DocumentCard
                canManage={canManage}
                document={document}
                employees={employees}
                index={index}
                key={document.id}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmployeeDocumentArchive({
  canManage,
  documents,
  employees,
  folders,
}: {
  canManage: boolean;
  documents: EmployeeDocument[];
  employees: Employee[];
  folders: DocumentFolder[];
}) {
  if (employees.length === 0 && documents.length === 0) {
    return <DocumentsEmptyState />;
  }

  return (
    <div className="space-y-4">
      {groupDocumentsByCompanyEmployee(employees, documents).map((companyGroup) => (
        <section
          className="overflow-hidden rounded-[22px] border border-[#d5dee9] bg-white shadow-sm"
          key={companyGroup.company.id}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#edf0f5] bg-[#f7faff] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f46e5]">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1f242d]">
                  {companyGroup.company.name}
                </p>
                <p className="text-xs font-semibold text-[#667085]">
                  {companyGroup.employees.length} trabajador
                  {companyGroup.employees.length === 1 ? "" : "es"}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#667085]">
              {companyGroup.documentCount} docs
            </span>
          </div>

          <div className="space-y-4 p-3">
            {companyGroup.employees.map((employeeGroup) => (
              <article
                className="rounded-[20px] border border-[#e1e5eb] bg-[#fbfcfd] p-3"
                key={employeeGroup.employee.id}
              >
                <div className="flex flex-col gap-3 border-b border-[#edf0f5] pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-[#4f46e5] shadow-sm">
                      {employeeInitials(employeeGroup.employee)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1f242d]">
                        {employeeGroup.employee.firstName}{" "}
                        {employeeGroup.employee.lastName}
                      </p>
                      <p className="truncate text-xs font-semibold text-[#667085]">
                        {employeeGroup.employee.jobTitle ?? "Sin cargo definido"}
                      </p>
                    </div>
                  </div>
                  <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-[#667085]">
                    {employeeGroup.documentCount} documentos
                  </span>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {folderRowsForEmployee(
                    folders,
                    companyGroup.company.id,
                    employeeGroup.folders,
                  ).map((folderRow) => (
                    <div
                      className="rounded-2xl border border-[#dfe5ee] bg-white p-3"
                      key={folderRow.key}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                            <FolderOpen className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#1f242d]">
                              {folderRow.name}
                            </p>
                            <p className="text-xs font-semibold text-[#667085]">
                              {folderRow.items.length} archivo
                              {folderRow.items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        {canManage && folderRow.folder ? (
                          <CreateDocumentForm
                            employees={employees}
                            folders={folders}
                            initialEmployeeIds={[employeeGroup.employee.id]}
                            initialFolderId={folderRow.folder.id}
                            pinnedEmployees={[
                              archiveEmployeeToEmployee(employeeGroup.employee),
                            ]}
                            triggerLabel="Subir aqui"
                            variant="compact"
                          />
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-2">
                        {folderRow.items.length > 0 ? (
                          folderRow.items.map((document) => (
                            <CompactDocumentRow
                              canManage={canManage}
                              document={document}
                              employees={employees}
                              key={document.id}
                            />
                          ))
                        ) : (
                          <p className="rounded-xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] px-3 py-3 text-xs font-semibold text-[#667085]">
                            Carpeta lista para cargar documentos.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CompactDocumentRow({
  canManage,
  document,
  employees,
}: {
  canManage: boolean;
  document: EmployeeDocument;
  employees: Employee[];
}) {
  return (
    <div className="rounded-xl border border-[#edf0f5] bg-[#fbfcfd] p-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1f242d]">
            {document.title}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[#667085]">
            {documentStatusText(document.status)}
            {document.expiresAt ? ` · vence ${formatDate(document.expiresAt)}` : ""}
          </p>
        </div>
        {canManage ? (
          <DocumentRowActions document={document} employees={employees} />
        ) : null}
      </div>
      {document.fileUrl ? (
        <DocumentFilePreview
          actionLabel="Abrir"
          className="mt-2"
          fallbackName={document.title}
          fileName={document.fileName}
          fileSize={document.fileSize}
          fileUrl={document.fileUrl}
          mimeType={document.mimeType}
        />
      ) : null}
    </div>
  );
}

function DocumentsEmptyState() {
  return (
    <div className="lg:col-span-4">
      <EmptyState
        description="Cambia filtros o registra un nuevo documento para verlo aqui."
        icon={FileText}
        title="No hay documentos con los filtros seleccionados"
      />
    </div>
  );
}

type ArchiveCompany = EmployeeDocument["company"];
type ArchiveEmployee = EmployeeDocument["employee"] & {
  company: ArchiveCompany;
};
type ArchiveFolderGroup = {
  folder: DocumentFolder | null;
  items: EmployeeDocument[];
  key: string;
  name: string;
};
type ArchiveEmployeeGroup = {
  documentCount: number;
  employee: ArchiveEmployee;
  folders: Map<string, ArchiveFolderGroup>;
};

function groupDocumentsByCompanyEmployee(
  employees: Employee[],
  documents: EmployeeDocument[],
) {
  const companies = new Map<
    string,
    {
      company: ArchiveCompany;
      documentCount: number;
      employees: Map<string, ArchiveEmployeeGroup>;
    }
  >();

  for (const employee of employees) {
    let companyGroup = companies.get(employee.company.id);

    if (!companyGroup) {
      companyGroup = {
        company: employee.company,
        documentCount: 0,
        employees: new Map(),
      };
      companies.set(employee.company.id, companyGroup);
    }

    if (!companyGroup.employees.has(employee.id)) {
      companyGroup.employees.set(employee.id, {
        documentCount: 0,
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          jobTitle: employee.jobTitle,
          company: employee.company,
        },
        folders: new Map(),
      });
    }
  }

  for (const document of documents) {
    let companyGroup = companies.get(document.company.id);

    if (!companyGroup) {
      companyGroup = {
        company: document.company,
        documentCount: 0,
        employees: new Map(),
      };
      companies.set(document.company.id, companyGroup);
    }

    companyGroup.documentCount += 1;

    let employeeGroup = companyGroup.employees.get(document.employee.id);

    if (!employeeGroup) {
      employeeGroup = {
        documentCount: 0,
        employee: { ...document.employee, company: document.company },
        folders: new Map(),
      };
      companyGroup.employees.set(document.employee.id, employeeGroup);
    }

    employeeGroup.documentCount += 1;

    const folderKey =
      document.folderRef?.id ?? `legacy:${document.folder || "General"}`;
    const folderName = document.folderRef?.name ?? document.folder ?? "General";
    const folderGroup =
      employeeGroup.folders.get(folderKey) ??
      ({
        folder: null,
        items: [],
        key: folderKey,
        name: folderName,
      } satisfies ArchiveFolderGroup);

    folderGroup.items.push(document);
    employeeGroup.folders.set(folderKey, folderGroup);
  }

  return Array.from(companies.values()).map((companyGroup) => ({
    company: companyGroup.company,
    documentCount: companyGroup.documentCount,
    employees: Array.from(companyGroup.employees.values()),
  }));
}

function folderRowsForEmployee(
  folders: DocumentFolder[],
  companyId: string,
  documentFolders: Map<string, ArchiveFolderGroup>,
) {
  const rows = new Map<string, ArchiveFolderGroup>();

  for (const folder of folders) {
    if (folder.company && folder.company.id !== companyId) {
      continue;
    }

    rows.set(folder.id, {
      folder,
      items: documentFolders.get(folder.id)?.items ?? [],
      key: folder.id,
      name: folder.name,
    });
  }

  for (const folderGroup of documentFolders.values()) {
    if (!rows.has(folderGroup.key)) {
      rows.set(folderGroup.key, folderGroup);
    }
  }

  return Array.from(rows.values());
}

function archiveEmployeeToEmployee(employee: ArchiveEmployee): Employee {
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    documentNumber: null,
    employeeCode: null,
    areaId: null,
    positionId: null,
    teamId: null,
    managerId: null,
    jobTitle: employee.jobTitle,
    area: null,
    hireDate: null,
    terminatedAt: null,
    terminationReason: null,
    status: "ACTIVE",
    company: employee.company,
    areaRef: null,
    position: null,
    team: null,
    manager: null,
    user: null,
  };
}

function employeeInitials(employee: {
  firstName: string;
  lastName: string;
}) {
  return `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();
}

function documentStatusText(status: EmployeeDocument["status"]) {
  return {
    DRAFT: "Borrador",
    EXPIRED: "Vencido",
    PENDING_SIGNATURE: "Pendiente de firma",
    SIGNED: "Firmado",
  }[status];
}

function FolderOverview({
  canManage,
  folders,
}: {
  canManage: boolean;
  folders: DocumentFolder[];
}) {
  if (folders.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {folders.slice(0, 8).map((folder) => (
        <div
          className="rounded-[18px] border border-[#d5dee9] bg-[#f7faff] p-3 shadow-sm"
          key={folder.id}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
              <FolderOpen className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#667085]">
              {folder._count?.documents ?? 0}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-[#1f242d]">
            {folder.name}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667085]">
            {folder.description ?? "Carpeta documental"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#475467]">
              {folder.visibleToEmployee ? "Portal" : "Solo RRHH"}
            </span>
            {folder.requiresSignature ? (
              <span className="rounded-full bg-[#fff7df] px-2 py-1 text-[11px] font-bold text-[#b86b00]">
                Firma
              </span>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-3 flex justify-end">
              <DocumentFolderActions folder={folder} />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function DocumentsPaginationControls({
  filters,
  pagination,
}: {
  filters: DocumentFilters;
  pagination: DocumentsPagination;
}) {
  return (
    <CursorPagination
      className="mt-5"
      firstHref={`/documentos?${buildPaginationQuery(filters)}`}
      hasNextPage={pagination.hasNextPage}
      nextHref={`/documentos?${buildPaginationQuery(filters, pagination.nextCursor ?? undefined)}`}
      totalLabel={cursorLabel(
        "documentos",
        filters.cursor,
        pagination.hasNextPage,
      )}
    />
  );
}

function buildPaginationQuery(filters: DocumentFilters, cursor?: string) {
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

  if (filters.folder) {
    query.set("carpeta", filters.folder);
  }

  if (filters.folderId) {
    query.set("carpeta", filters.folderId);
  }

  if (filters.status) {
    query.set("estado", filters.status);
  }

  if (filters.type) {
    query.set("tipo", filters.type);
  }

  query.set("vista", filters.view === "folder" ? "carpeta" : "trabajador");

  if (cursor) {
    query.set("cursor", cursor);
  }

  query.set("porPagina", String(filters.pageSize ?? 10));

  return query.toString();
}

function paginationLabel(
  pagination: DocumentsPagination,
  visibleCount: number,
) {
  if (pagination.total === null || pagination.totalPages === null) {
    return `Mostrando ${visibleCount} documentos${pagination.hasNextPage ? " · hay mas resultados" : ""}`;
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
    ? `Primeros ${noun} cargados · hay mas resultados`
    : `Todos los ${noun} filtrados estan visibles`;
}

function DocumentCard({
  canManage,
  document,
  employees,
  index,
}: {
  canManage: boolean;
  document: EmployeeDocument;
  employees: Employee[];
  index: number;
}) {
  const status = {
    DRAFT: { label: "Borrador", tone: "neutral" as const },
    EXPIRED: { label: "Vencido", tone: "danger" as const },
    PENDING_SIGNATURE: { label: "Pend. firma", tone: "warning" as const },
    SIGNED: { label: "Firmado", tone: "success" as const },
  }[document.status];

  const typeLabel = {
    CERTIFICATE: "Certificado",
    CONTRACT: "Contrato",
    OTHER: "Otro",
    PAYSLIP: "Boleta",
    POLICY: "Politica",
  }[document.type];

  return (
    <article
      className="animate-rise flex min-h-[292px] flex-col rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#b9c5d6] hover:bg-white hover:shadow-[0_16px_34px_rgba(16,24,40,0.065)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
          <FileText className="h-5 w-5" />
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <h3 className="mt-4 whitespace-normal break-words text-base font-semibold leading-5">
        {document.title}
      </h3>
      <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-[#667085]">
        {typeLabel}
      </p>
      <p className="mt-2 inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#667085]">
        {document.folderRef?.name ?? document.folder}
      </p>

      <div className="mt-4 rounded-xl bg-white p-3">
        <p className="whitespace-normal break-words text-sm font-semibold leading-5">
          {document.employee.firstName} {document.employee.lastName}
        </p>
        <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-[#667085]">
          {document.company.name}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[#667085]">
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
          <CalendarDays className="h-3.5 w-3.5 text-[#4f46e5]" />
          <span className="min-w-0 break-words">
            {document.expiresAt
              ? `Vence: ${formatDate(document.expiresAt)}`
              : "Sin vencimiento"}
          </span>
        </div>
        {document.fileUrl ? (
          <DocumentFilePreview
            actionLabel="Abrir"
            fallbackName={document.title}
            fileName={document.fileName}
            fileSize={document.fileSize}
            fileUrl={document.fileUrl}
            mimeType={document.mimeType}
          />
        ) : (
          <span className="rounded-xl bg-white px-3 py-2">
            Archivo pendiente
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#667085]">
          {document.visibleToEmployee ? "Visible portal" : "Solo RRHH"}
        </span>
        {document.requiresSignature ? (
          <span className="rounded-full bg-[#fff7df] px-2.5 py-1 text-xs font-bold text-[#b86b00]">
            Requiere firma
          </span>
        ) : null}
      </div>
      {canManage ? (
        <div className="mt-auto flex justify-end pt-3">
          <DocumentRowActions document={document} employees={employees} />
        </div>
      ) : null}
    </article>
  );
}

function formatDate(value: string) {
  return formatCalendarDate(value);
}
