import type { UserStatus } from '@prisma/client';

export type UpdateUserDto = {
  companyId?: string | null;
  employeeId?: string | null;
  employeeCompanyId?: string;
  roleId?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  password?: string;
  status?: UserStatus;
  documentNumber?: string;
  employeeCode?: string;
  attendancePin?: string;
  areaId?: string | null;
  positionId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  jobTitle?: string;
  area?: string;
  hireDate?: string;
};
