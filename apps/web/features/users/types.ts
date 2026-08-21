export type AppRole = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: string;
};

export type AppUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: "INVITED" | "ACTIVE" | "INACTIVE";
  createdAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  role: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  employee: {
    id: string;
    company: {
      id: string;
      name: string;
      slug: string;
    };
    documentNumber: string | null;
    employeeCode: string | null;
    areaId: string | null;
    positionId: string | null;
    teamId: string | null;
    managerId: string | null;
    jobTitle: string | null;
    area: string | null;
    areaRef: {
      id: string;
      name: string;
      slug: string;
    } | null;
    position: {
      id: string;
      name: string;
      slug: string;
    } | null;
    team: {
      id: string;
      name: string;
      slug: string;
    } | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    } | null;
    hireDate: string | null;
  } | null;
};

export type UserFilters = {
  companyId?: string;
  page?: number;
  pageSize?: number;
  roleId?: string;
  search?: string;
  status?: AppUser["status"];
};

export type UsersPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UsersPageResult = {
  data: AppUser[];
  meta: UsersPagination;
};

export type CreateUserPayload = {
  accessMode?: "admin" | "portal" | "both";
  companyId?: string | null;
  employeeId?: string;
  employeeCompanyId?: string;
  roleId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  status?: AppUser["status"];
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

export type UpdateUserPayload = {
  companyId?: string | null;
  employeeId?: string | null;
  employeeCompanyId?: string;
  roleId?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  password?: string;
  status?: AppUser["status"];
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

export type CreateRolePayload = {
  name: string;
  description?: string;
  permissions?: string[];
};

export type UpdateRolePayload = {
  name?: string;
  description?: string | null;
  permissions?: string[];
};
