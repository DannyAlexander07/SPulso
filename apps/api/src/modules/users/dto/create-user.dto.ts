import type { UserStatus } from '@prisma/client';

export type UserAccessMode = 'admin' | 'portal' | 'both';

export type CreateUserDto = {
  accessMode?: UserAccessMode;
  companyId?: string;
  employeeId?: string;
  employeeCompanyId?: string;
  roleId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
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
