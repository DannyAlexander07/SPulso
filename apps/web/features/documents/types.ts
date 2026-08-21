export type EmployeeDocument = {
  id: string;
  type: "CONTRACT" | "PAYSLIP" | "POLICY" | "CERTIFICATE" | "OTHER";
  status: "DRAFT" | "PENDING_SIGNATURE" | "SIGNED" | "EXPIRED";
  title: string;
  folder: string;
  visibleToEmployee: boolean;
  requiresSignature: boolean;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  notes: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  signedByName: string | null;
  signedByEmail: string | null;
  signatureText: string | null;
  signatureHash: string | null;
  createdAt: string;
  folderRef: {
    id: string;
    name: string;
    slug: string;
    visibleToEmployee: boolean;
    requiresSignature: boolean;
  } | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

export type DocumentFolder = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: EmployeeDocument["type"] | null;
  status: "ACTIVE" | "INACTIVE";
  visibleToEmployee: boolean;
  requiresSignature: boolean;
  allowMultiple: boolean;
  retentionYears: number | null;
  sortOrder: number;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  _count?: {
    documents: number;
  };
};

export type DocumentsSummary = {
  draft: number;
  pendingSignature: number;
  signed: number;
  expired: number;
  total: number;
};

export type DocumentFilters = {
  companyId?: string;
  cursor?: string;
  employeeId?: string;
  expiresFrom?: string;
  expiresTo?: string;
  folder?: string;
  folderId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: EmployeeDocument["status"];
  type?: EmployeeDocument["type"];
  view?: "employee" | "folder";
};

export type DocumentsPagination = {
  page: number;
  pageSize: number;
  total: number | null;
  totalPages: number | null;
  nextCursor: string | null;
  hasNextPage: boolean;
  mode?: "cursor" | "offset";
};

export type DocumentsPageResult = {
  data: EmployeeDocument[];
  meta: DocumentsPagination;
};

export type CreateDocumentPayload = {
  employeeId?: string;
  employeeIds?: string[];
  folderId?: string;
  type: EmployeeDocument["type"];
  status?: EmployeeDocument["status"];
  title: string;
  folder?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  visibleToEmployee?: boolean;
  requiresSignature?: boolean;
  notes?: string;
  issuedAt?: string;
  expiresAt?: string;
};

export type UpdateDocumentPayload = {
  employeeId?: string;
  folderId?: string | null;
  type?: EmployeeDocument["type"];
  status?: EmployeeDocument["status"];
  title?: string;
  folder?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  visibleToEmployee?: boolean;
  requiresSignature?: boolean;
  notes?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
};

export type CreateDocumentFolderPayload = {
  name: string;
  companyId?: string | null;
  description?: string | null;
  type?: EmployeeDocument["type"] | null;
  visibleToEmployee?: boolean;
  requiresSignature?: boolean;
  allowMultiple?: boolean;
  retentionYears?: number | null;
};

export type UpdateDocumentFolderPayload = Partial<CreateDocumentFolderPayload> & {
  status?: "ACTIVE" | "INACTIVE";
};
