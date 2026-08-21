import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import { assertImmediateExportLimit } from "@/lib/export-limits";
import type {
  CreateDocumentPayload,
  CreateDocumentFolderPayload,
  DocumentFilters,
  DocumentFolder,
  DocumentsPageResult,
  DocumentsSummary,
  EmployeeDocument,
  UpdateDocumentPayload,
  UpdateDocumentFolderPayload,
} from "./types";

const fallbackSummary: DocumentsSummary = {
  draft: 0,
  pendingSignature: 0,
  signed: 0,
  expired: 0,
  total: 0,
};

export function getDocuments(filters?: DocumentFilters, token?: string | null) {
  return getDocumentsPage({ pageSize: 100, ...filters }, token).then(
    (result) => result.data,
  );
}

export function getDocumentsPage(
  filters?: DocumentFilters,
  token?: string | null,
) {
  const query = buildDocumentsQuery(filters);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<DocumentsPageResult>(
    `/documentos${suffix}`,
    {
      data: [],
      meta: {
        page: filters?.page ?? 1,
        pageSize: filters?.pageSize ?? 10,
        total: null,
        totalPages: null,
        nextCursor: null,
        hasNextPage: false,
        mode: "cursor",
      },
    },
    token,
  );
}

export async function getDocumentsForExport(filters: DocumentFilters) {
  const pageSize = 100;
  let cursor: string | undefined;
  let hasNextPage = true;
  const documents: EmployeeDocument[] = [];

  do {
    const query = buildDocumentsQuery({
      ...filters,
      cursor,
      pageSize,
    });
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const response = await fetch(`${getApiUrl()}/documentos${suffix}`, {
      headers: clientAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message ?? "No se pudo preparar el archivo.");
    }

    const result = (await response.json()) as DocumentsPageResult;

    documents.push(...result.data);
    assertImmediateExportLimit(documents.length);
    cursor = result.meta.nextCursor ?? undefined;
    hasNextPage = result.meta.hasNextPage && Boolean(cursor);
  } while (hasNextPage);

  return documents;
}

function buildDocumentsQuery(filters?: DocumentFilters) {
  const query = new URLSearchParams();

  if (filters?.search) {
    query.set("search", filters.search);
  }

  if (filters?.companyId) {
    query.set("companyId", filters.companyId);
  }

  if (filters?.employeeId) {
    query.set("employeeId", filters.employeeId);
  }

  if (filters?.folder) {
    query.set("folder", filters.folder);
  }

  if (filters?.folderId) {
    query.set("folderId", filters.folderId);
  }

  if (filters?.expiresFrom) {
    query.set("expiresFrom", filters.expiresFrom);
  }

  if (filters?.expiresTo) {
    query.set("expiresTo", filters.expiresTo);
  }

  if (filters?.status) {
    query.set("status", filters.status);
  }

  if (filters?.type) {
    query.set("type", filters.type);
  }

  if (filters?.page) {
    query.set("page", String(filters.page));
  }

  if (filters?.cursor) {
    query.set("cursor", filters.cursor);
  }

  if (filters?.pageSize) {
    query.set("pageSize", String(filters.pageSize));
  }

  query.set("pagination", "cursor");

  return query;
}

export function getDocumentsSummary(token?: string | null) {
  return apiGet<DocumentsSummary>(
    "/documentos/resumen",
    fallbackSummary,
    token,
  );
}

export function getDocumentFolders(token?: string | null) {
  return apiGet<DocumentFolder[]>("/documentos/carpetas", [], token);
}

export async function createDocumentFolder(payload: CreateDocumentFolderPayload) {
  const response = await fetch(`${getApiUrl()}/documentos/carpetas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear la carpeta.");
  }

  return response.json() as Promise<DocumentFolder>;
}

export async function updateDocumentFolder(
  folderId: string,
  payload: UpdateDocumentFolderPayload,
) {
  const response = await fetch(`${getApiUrl()}/documentos/carpetas/${folderId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar la carpeta.");
  }

  return response.json() as Promise<DocumentFolder>;
}

export async function deleteDocumentFolder(folderId: string) {
  const response = await fetch(`${getApiUrl()}/documentos/carpetas/${folderId}`, {
    method: "DELETE",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo eliminar la carpeta.");
  }

  return response.json() as Promise<{ deleted: true; id: string }>;
}

export async function createDocument(payload: CreateDocumentPayload) {
  const response = await fetch(`${getApiUrl()}/documentos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear el documento.");
  }

  return response.json() as Promise<EmployeeDocument>;
}

export async function uploadDocumentFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiUrl()}/archivos/documentos`, {
    method: "POST",
    headers: clientAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo subir el archivo.");
  }

  return response.json() as Promise<{
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
}

export function documentZipExportUrl(filters: DocumentFilters) {
  const query = new URLSearchParams();

  if (filters.companyId) query.set("companyId", filters.companyId);
  if (filters.employeeId) query.set("employeeId", filters.employeeId);
  if (filters.folderId) query.set("folderId", filters.folderId);
  if (filters.status) query.set("status", filters.status);
  if (filters.type) query.set("type", filters.type);

  return `${getApiUrl()}/documentos/exportar/zip${query.size > 0 ? `?${query.toString()}` : ""}`;
}

export async function updateDocument(
  documentId: string,
  payload: UpdateDocumentPayload,
) {
  const response = await fetch(`${getApiUrl()}/documentos/${documentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar el documento.");
  }

  return response.json() as Promise<EmployeeDocument>;
}

export async function deleteDocument(documentId: string) {
  const response = await fetch(`${getApiUrl()}/documentos/${documentId}`, {
    method: "DELETE",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo eliminar el documento.");
  }

  return response.json() as Promise<{ id: string; deleted: true }>;
}
