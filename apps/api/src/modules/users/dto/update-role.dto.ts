export type UpdateRoleDto = {
  name?: string;
  description?: string | null;
  permissions?: string[];
};
