export type ExportJobType = "EMPLOYEES" | "DOCUMENTS" | "REQUESTS" | "USERS";

export type ExportJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type ExportJob = {
  company: { id: string; name: string; slug: string } | null;
  completedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  fileName: string | null;
  filters: Record<string, unknown> | null;
  id: string;
  requestedBy: {
    email: string;
    firstName: string;
    id: string;
    lastName: string;
  };
  rowCount: number;
  startedAt: string | null;
  status: ExportJobStatus;
  type: ExportJobType;
};
