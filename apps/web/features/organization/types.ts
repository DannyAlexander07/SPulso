import type { Company } from "@/features/companies/types";

export type OrganizationStatus = "ACTIVE" | "INACTIVE";
export type JobPositionScope = "COMPANY" | "GROUP";

export type OrganizationEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  area: string | null;
  teamId: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
  company: CompanyRef;
  areaRef: Pick<Area, "id" | "name" | "slug"> | null;
  position: Pick<JobPosition, "id" | "name" | "slug"> | null;
  team: Pick<WorkTeam, "id" | "name" | "slug"> | null;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  } | null;
};

export type CompanyRef = Pick<Company, "id" | "name" | "slug">;

export type Area = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: OrganizationStatus;
  createdAt: string;
  company: CompanyRef;
  _count: {
    employees: number;
    jobPositions: number;
    workTeams: number;
  };
};

export type JobPosition = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  scope: JobPositionScope;
  status: OrganizationStatus;
  createdAt: string;
  company: CompanyRef | null;
  area: Pick<Area, "id" | "name" | "slug"> | null;
  _count: {
    employees: number;
  };
};

export type WorkTeam = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: OrganizationStatus;
  createdAt: string;
  company: CompanyRef;
  area: Pick<Area, "id" | "name" | "slug"> | null;
  client: Pick<Client, "id" | "name" | "slug"> | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  } | null;
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    status: "ACTIVE" | "INACTIVE" | "TERMINATED";
    areaRef: Pick<Area, "id" | "name" | "slug"> | null;
    position: Pick<JobPosition, "id" | "name" | "slug"> | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    } | null;
  }>;
  _count: {
    employees: number;
  };
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  ruc: string | null;
  description: string | null;
  status: OrganizationStatus;
  createdAt: string;
  company: CompanyRef;
  _count: {
    workTeams: number;
    employeeClientAssignments: number;
  };
};

export type EmployeeClientAssignment = {
  id: string;
  role: string | null;
  isPrimary: boolean;
  status: OrganizationStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  company: CompanyRef;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  };
  client: Pick<Client, "id" | "name" | "slug">;
  area: Pick<Area, "id" | "name" | "slug"> | null;
  team: Pick<WorkTeam, "id" | "name" | "slug"> | null;
};

export type OrganizationData = {
  areas: Area[];
  clients: Client[];
  assignments: EmployeeClientAssignment[];
  positions: JobPosition[];
  teams: WorkTeam[];
  employees: OrganizationEmployee[];
  summary: {
    areas: number;
    clients: number;
    assignments: number;
    positions: number;
    teams: number;
    employees: number;
  };
};

export type OrganizationPayload = {
  companyId: string;
  areaId?: string | null;
  clientId?: string | null;
  leaderEmployeeId?: string | null;
  scope?: JobPositionScope;
  name: string;
  slug?: string;
  description?: string | null;
  status?: OrganizationStatus;
};

export type AssignmentPayload = {
  employeeId?: string;
  clientId?: string;
  areaId?: string | null;
  teamId?: string | null;
  role?: string | null;
  isPrimary?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: OrganizationStatus;
};

export type StructuralImpact = {
  code: "STRUCTURAL_IMPACT";
  title: string;
  message: string;
  recommendation: string;
  impacts: Array<{
    label: string;
    count: number;
  }>;
  actions: string[];
};
