import type { DocumentStatus, DocumentType } from '@prisma/client';

export type UpdateDocumentDto = {
  employeeId?: string;
  folderId?: string | null;
  type?: DocumentType;
  status?: DocumentStatus;
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

export type UpdateDocumentFolderDto = {
  name?: string;
  companyId?: string | null;
  description?: string | null;
  type?: DocumentType | null;
  visibleToEmployee?: boolean;
  requiresSignature?: boolean;
  allowMultiple?: boolean;
  retentionYears?: number | null;
  status?: 'ACTIVE' | 'INACTIVE';
};
