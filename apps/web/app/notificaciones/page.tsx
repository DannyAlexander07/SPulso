import { getCurrentUser } from "@/features/auth/api";
import { NotificationsView } from "@/features/notifications/notifications-view";
import {
  getNotificationsPage,
  getNotificationsSummary,
} from "@/features/notifications/api";
import type {
  NotificationPriority,
  NotificationStatus,
} from "@/features/notifications/types";
import { getServerToken } from "@/lib/server-auth";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string;
    estado?: NotificationStatus;
    page?: string;
    prioridad?: NotificationPriority;
  }>;
}) {
  const token = await getServerToken();
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const [currentUser, notificationsPage, summary] = await Promise.all([
    getCurrentUser(token),
    getNotificationsPage(
      {
        page: Number.isInteger(page) && page > 0 ? page : 1,
        pageSize: 20,
        cursor: params.cursor?.trim() || undefined,
        priority: params.prioridad,
        status: params.estado,
      },
      token,
    ),
    getNotificationsSummary(token),
  ]);

  return (
    <NotificationsView
      currentUser={currentUser}
      filters={{
        cursor: params.cursor?.trim() || undefined,
        priority: params.prioridad,
        status: params.estado,
      }}
      notifications={notificationsPage.data}
      pagination={notificationsPage.meta}
      summary={summary}
    />
  );
}
