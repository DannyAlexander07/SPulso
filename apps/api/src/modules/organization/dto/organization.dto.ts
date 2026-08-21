import type { JobPositionScope, OrganizationStatus } from '@prisma/client';

export type CreateAreaDto = {
  companyId?: string;
  name?: string;
  slug?: string;
  description?: string;
};

export type UpdateAreaDto = Partial<CreateAreaDto> & {
  status?: OrganizationStatus;
};

export type CreateJobPositionDto = {
  companyId?: string;
  areaId?: string;
  scope?: JobPositionScope;
  name?: string;
  slug?: string;
  description?: string;
};

export type UpdateJobPositionDto = Partial<CreateJobPositionDto> & {
  status?: OrganizationStatus;
};

export type CreateClientDto = {
  companyId?: string;
  name?: string;
  slug?: string;
  ruc?: string;
  description?: string;
};

export type UpdateClientDto = Partial<CreateClientDto> & {
  status?: OrganizationStatus;
};

export type CreateWorkTeamDto = {
  companyId?: string;
  areaId?: string;
  clientId?: string | null;
  leaderEmployeeId?: string;
  name?: string;
  slug?: string;
  description?: string;
};

export type UpdateWorkTeamDto = Partial<CreateWorkTeamDto> & {
  status?: OrganizationStatus;
};

export type UpdateWorkTeamMembersDto = {
  leaderEmployeeId?: string;
  employeeIds?: string[];
};

export type CreateEmployeeClientAssignmentDto = {
  employeeId?: string;
  clientId?: string;
  areaId?: string | null;
  teamId?: string | null;
  role?: string | null;
  isPrimary?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type UpdateEmployeeClientAssignmentDto =
  Partial<CreateEmployeeClientAssignmentDto> & {
    status?: OrganizationStatus;
  };
