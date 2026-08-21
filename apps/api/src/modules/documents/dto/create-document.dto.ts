import type { DocumentStatus, DocumentType } from '@prisma/client';

export type CreateDocumentDto = {
  employeeId?: string;
  employeeIds?: string[];
  folderId?: string;
  type: DocumentType;
  status?: DocumentStatus;
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

export type CreateDocumentFolderDto = {
  name: string;
  companyId?: string | null;
  description?: string | null;
  type?: DocumentType | null;
  visibleToEmployee?: boolean;
  requiresSignature?: boolean;
  allowMultiple?: boolean;
  retentionYears?: number | null;
};
