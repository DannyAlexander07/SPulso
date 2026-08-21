export type TransferEmployeeDto = {
  areaId?: string | null;
  clientId?: string | null;
  companyId: string;
  effectiveDate?: string | null;
  isPrimaryClientAssignment?: boolean;
  managerId?: string | null;
  positionId?: string | null;
  reason?: string | null;
  role?: string | null;
  teamId?: string | null;
};
