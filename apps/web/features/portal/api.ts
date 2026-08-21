import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type { PortalProfile } from "./types";

export function getPortalProfile(token?: string | null) {
  return apiGet<PortalProfile | null>("/portal/perfil", null, token);
}

export type CreatePortalRequestPayload = {
  type: "VACATION" | "PERMISSION" | "REMOTE_WORK" | "MEDICAL_LEAVE" | "OTHER";
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
};

export async function createPortalRequest(payload: CreatePortalRequestPayload) {
  const response = await fetch(`${getApiUrl()}/portal/solicitudes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo enviar la solicitud.");
  }

  return response.json();
}

export async function signPortalDocument(id: string, signatureText: string) {
  const response = await fetch(`${getApiUrl()}/portal/documentos/${id}/firmar`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify({ signatureText }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo firmar el documento.");
  }

  return response.json();
}

export async function markPortalAnnouncementAsRead(id: string) {
  const response = await fetch(`${getApiUrl()}/portal/comunicados/${id}/leido`, {
    method: "PATCH",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo marcar el comunicado como leido.");
  }

  return response.json();
}

export type UpdatePortalProfilePayload = {
  address?: string;
  personalEmail?: string;
  phoneMobile?: string;
};

export async function updatePortalProfile(payload: UpdatePortalProfilePayload) {
  const response = await fetch(`${getApiUrl()}/portal/ficha`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar tu ficha.");
  }

  return response.json();
}

export async function uploadPortalProfileImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiUrl()}/portal/foto/archivo`, {
    method: "POST",
    headers: clientAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo subir la foto.");
  }

  return response.json() as Promise<{
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
}

export async function updatePortalProfilePhoto(avatarUrl: string | null) {
  const response = await fetch(`${getApiUrl()}/portal/foto`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify({ avatarUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo actualizar la foto.");
  }

  return response.json() as Promise<{ avatarUrl: string | null }>;
}
