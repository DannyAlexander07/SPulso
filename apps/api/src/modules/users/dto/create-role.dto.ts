export type CreateRoleDto = {
  name: string;
  description?: string;
  permissions?: string[];
};
