export type AuthUser = {
  id: string;
  tenantId: string;
  roleId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  status: string;
  themePreference?: "light" | "dark" | "star";
  employeeId?: string | null;
  employee?: {
    id: string;
    jobTitle: string | null;
    companyName: string;
    positionName: string | null;
    teamName: string | null;
  } | null;
  access?: {
    admin: boolean;
    portal: boolean;
  };
  role: {
    id: string;
    name: string;
    permissions?: string[];
  } | null;
  permissions?: string[];
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};
