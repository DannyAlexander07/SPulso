import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import { assertImmediateExportLimit } from "@/lib/export-limits";
import type {
  AppRole,
  AppUser,
  CreateRolePayload,
  CreateUserPayload,
  UpdateRolePayload,
  UpdateUserPayload,
  UserFilters,
  UsersPageResult,
} from "./types";

export function getUsers(filters?: UserFilters, token?: string | null) {
  return getUsersPage({ pageSize: 100, ...filters }, token).then(
    (result) => result.data,
  );
}

export function getUsersPage(filters?: UserFilters, token?: string | null) {
  const query = buildUsersQuery(filters);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<UsersPageResult>(
    `/usuarios${suffix}`,
    {
      data: [],
      meta: {
        page: filters?.page ?? 1,
        pageSize: filters?.pageSize ?? 10,
        total: 0,
        totalPages: 1,
      },
    },
    token,
  );
}

export async function getUsersForExport(filters: UserFilters) {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const users: AppUser[] = [];

  do {
    const query = buildUsersQuery({
      ...filters,
      page,
      pageSize,
    });
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const response = await fetch(`${getApiUrl()}/usuarios${suffix}`, {
      headers: clientAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message ?? "No se pudo preparar el archivo.");
    }

    const result = (await response.json()) as UsersPageResult;

    users.push(...result.data);
    assertImmediateExportLimit(users.length);
    totalPages = result.meta.totalPages;
    page += 1;
  } while (page <= totalPages);

  return users;
}

function buildUsersQuery(filters?: UserFilters) {
  const query = new URLSearchParams();

  if (filters?.search) {
    query.set("search", filters.search);
  }

  if (filters?.companyId) {
    query.set("companyId", filters.companyId);
  }

  if (filters?.roleId) {
    query.set("roleId", filters.roleId);
  }

  if (filters?.status) {
    query.set("status", filters.status);
  }

  if (filters?.page) {
    query.set("page", String(filters.page));
  }

  if (filters?.pageSize) {
    query.set("pageSize", String(filters.pageSize));
  }

  return query;
}

export function getRoles(token?: string | null) {
  return apiGet<AppRole[]>("/usuarios/roles", [], token);
}

export async function createRole(payload: CreateRolePayload) {
  const response = await fetch(`${getApiUrl()}/usuarios/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear el rol.");
  }

  return response.json() as Promise<AppRole>;
}

export async function uploadUserImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiUrl()}/archivos/usuarios`, {
    method: "POST",
    headers: clientAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo subir la imagen.");
  }

  return response.json() as Promise<{
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
}

export async function updateRole(roleId: string, payload: UpdateRolePayload) {
  const response = await fetch(`${getApiUrl()}/usuarios/roles/${roleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar el rol.");
  }

  return response.json() as Promise<AppRole>;
}

export async function deleteRole(roleId: string) {
  const response = await fetch(`${getApiUrl()}/usuarios/roles/${roleId}`, {
    method: "DELETE",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo eliminar el rol.");
  }

  return response.json() as Promise<{ deleted: boolean; id: string }>;
}

export async function createUser(payload: CreateUserPayload) {
  const response = await fetch(`${getApiUrl()}/usuarios`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear el usuario.");
  }

  return response.json() as Promise<AppUser>;
}

export async function updateUser(userId: string, payload: UpdateUserPayload) {
  const response = await fetch(`${getApiUrl()}/usuarios/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar el usuario.");
  }

  return response.json() as Promise<AppUser>;
}

export async function deleteUser(userId: string) {
  const response = await fetch(`${getApiUrl()}/usuarios/${userId}`, {
    method: "DELETE",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo eliminar el usuario.");
  }

  return response.json() as Promise<{ deleted: boolean; id: string }>;
}
