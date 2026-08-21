export type CreateExportJobDto = {
  filters?: Record<string, unknown>;
  type: 'EMPLOYEES' | 'DOCUMENTS' | 'REQUESTS' | 'USERS';
};
