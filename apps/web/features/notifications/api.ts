import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type {
  NotificationFilters,
  NotificationsPageResult,
  NotificationsSummary,
  AppNotification,
} from "./types";

const fallbackSummary: NotificationsSummary = {
  critical: 0,
  read: 0,
  total: 0,
  unread: 0,
  warning: 0,
};

export function getNotifications(
  filters?: NotificationFilters,
  token?: string | null,
) {
  return getNotificationsPage({ pageSize: 20, ...filters }, token).then(
    (result) => result.data,
  );
}

export function getNotificationsPage(
  filters?: NotificationFilters,
  token?: string | null,
) {
  const query = buildNotificationsQuery(filters);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiGet<NotificationsPageResult>(
    `/notificaciones${suffix}`,
    {
      data: [],
      meta: {
        page: filters?.page ?? 1,
        pageSize: filters?.pageSize ?? 20,
        total: null,
        totalPages: null,
        nextCursor: null,
        hasNextPage: false,
        mode: "cursor",
      },
    },
    token,
  );
}

export function getNotificationsSummary(token?: string | null) {
  return apiGet<NotificationsSummary>(
    "/notificaciones/resumen",
    fallbackSummary,
    token,
  );
}

export async function markNotificationAsRead(notificationId: string) {
  const response = await fetch(
    `${getApiUrl()}/notificaciones/${notificationId}/leida`,
    {
      method: "PATCH",
      headers: clientAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo marcar la notificacion.");
  }

  return response.json() as Promise<AppNotification>;
}

export async function markNotificationAsUnread(notificationId: string) {
  const response = await fetch(
    `${getApiUrl()}/notificaciones/${notificationId}/no-leida`,
    {
      method: "PATCH",
      headers: clientAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo cambiar la notificacion.");
  }

  return response.json() as Promise<AppNotification>;
}

function buildNotificationsQuery(filters?: NotificationFilters) {
  const query = new URLSearchParams();

  if (filters?.page) {
    query.set("page", String(filters.page));
  }

  if (filters?.cursor) {
    query.set("cursor", filters.cursor);
  }

  if (filters?.pageSize) {
    query.set("pageSize", String(filters.pageSize));
  }

  if (filters?.priority) {
    query.set("priority", filters.priority);
  }

  if (filters?.status) {
    query.set("status", filters.status);
  }

  if (filters?.type) {
    query.set("type", filters.type);
  }

  query.set("pagination", "cursor");

  return query;
}
