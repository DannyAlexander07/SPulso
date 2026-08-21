import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type { Announcement, AnnouncementDetail, AnnouncementPayload, AnnouncementsResult } from "./types";

const fallback: AnnouncementsResult = {
  data: [],
  summary: { pinned: 0, published: 0, scheduled: 0, segmented: 0, total: 0 },
};

export function getAnnouncements(
  filters?: { priority?: string; scope?: string; search?: string; status?: string },
  token?: string | null,
) {
  const query = new URLSearchParams();

  if (filters?.priority) query.set("priority", filters.priority);
  if (filters?.scope) query.set("scope", filters.scope);
  if (filters?.search) query.set("search", filters.search);
  if (filters?.status) query.set("status", filters.status);

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<AnnouncementsResult>(`/comunicados${suffix}`, fallback, token);
}

export function createAnnouncement(payload: AnnouncementPayload) {
  return send<Announcement>("/comunicados", "POST", payload);
}

export function getAnnouncement(id: string, token?: string | null) {
  return apiGet<AnnouncementDetail | null>(`/comunicados/${id}`, null, token);
}

export function updateAnnouncement(id: string, payload: Partial<AnnouncementPayload>) {
  return send<Announcement>(`/comunicados/${id}`, "PATCH", payload);
}

export async function uploadAnnouncementImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiUrl()}/archivos/comunicados`, {
    method: "POST",
    headers: clientAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo subir la imagen.");
  }

  return response.json() as Promise<{ fileName: string; mimeType: string; size: number; url: string }>;
}

export async function sendAnnouncementEmails(id: string) {
  const response = await fetch(`${getApiUrl()}/comunicados/${id}/enviar-correos`, {
    method: "POST",
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo procesar la cola de correos.");
  }

  return response.json() as Promise<{
    mode: "simulation";
    processed: number;
    previewHtml: string;
    queue: AnnouncementDetail["emailQueue"];
  }>;
}

async function send<T>(path: string, method: "PATCH" | "POST", payload: unknown) {
  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo guardar el comunicado.");
  }

  return response.json() as Promise<T>;
}
