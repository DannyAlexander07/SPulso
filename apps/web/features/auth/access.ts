import type { AuthUser } from "./types";

export function getDefaultWorkspacePath(user: AuthUser) {
  const access = getWorkspaceAccess(user);

  if (access.admin && access.portal) {
    return "/seleccionar-panel";
  }

  if (access.admin) {
    return "/";
  }

  if (access.portal) {
    return "/portal";
  }

  return "/login";
}

export function getWorkspaceAccess(user: AuthUser) {
  return {
    admin: Boolean(user.access?.admin),
    portal: Boolean(user.access?.portal),
  };
}
