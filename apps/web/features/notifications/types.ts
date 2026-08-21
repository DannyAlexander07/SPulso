export type NotificationPriority = "INFO" | "WARNING" | "CRITICAL";
export type NotificationStatus = "UNREAD" | "READ";
export type NotificationType =
  | "DOCUMENT_EXPIRING"
  | "DOCUMENT_EXPIRED"
  | "DOCUMENT_PENDING_SIGNATURE"
  | "REQUEST_PENDING"
  | "ATTENDANCE_LATE"
  | "ANNOUNCEMENT_PUBLISHED";

export type AppNotification = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  actionHref: string | null;
  entityType: string | null;
  entityId: string | null;
  generatedAt: string;
  readAt: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type NotificationsSummary = {
  critical: number;
  read: number;
  total: number;
  unread: number;
  warning: number;
};

export type NotificationFilters = {
  cursor?: string;
  page?: number;
  pageSize?: number;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  type?: NotificationType;
};

export type NotificationsPagination = {
  page: number;
  pageSize: number;
  total: number | null;
  totalPages: number | null;
  nextCursor: string | null;
  hasNextPage: boolean;
  mode?: "cursor" | "offset";
};

export type NotificationsPageResult = {
  data: AppNotification[];
  meta: NotificationsPagination;
};
