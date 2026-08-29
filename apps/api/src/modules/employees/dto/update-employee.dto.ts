import type { EmployeeStatus } from '@prisma/client';

export type UpdateEmployeeDto = {
  companyId?: string;
  areaId?: string | null;
  positionId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  firstName?: string;
  lastName?: string;
  documentNumber?: string | null;
  personalEmail?: string | null;
  phoneMobile?: string | null;
  address?: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  area?: string | null;
  hireDate?: string | null;
  terminatedAt?: string | null;
  terminationReason?: string | null;
  status?: EmployeeStatus;
};
