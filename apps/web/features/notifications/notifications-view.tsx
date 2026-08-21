import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  FileClock,
  FileSignature,
  FileWarning,
  MapPin,
  Megaphone,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/surface";
import type { AuthUser } from "@/features/auth/types";
import { NotificationReadButton } from "./notification-actions";
import type {
  AppNotification,
  NotificationPriority,
  NotificationsPagination,
  NotificationsSummary,
  NotificationStatus,
} from "./types";

export function NotificationsView({
  currentUser,
  filters,
  notifications,
  pagination,
  summary,
}: {
  currentUser: AuthUser | null;
  filters: {
    cursor?: string;
    priority?: NotificationPriority;
    status?: NotificationStatus;
  };
  notifications: AppNotification[];
  pagination: NotificationsPagination;
  summary: NotificationsSummary;
}) {
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/notificaciones" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar
            currentUser={currentUser}
            eyebrow="Automatizaciones"
            title="Centro de notificaciones"
          />

          <div className="mx-auto max-w-7xl px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 lg:grid-cols-4">
              <MetricCard
                icon={BellRing}
                label="Sin leer"
                value={summary.unread.toString()}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Criticas"
                tone="danger"
                value={summary.critical.toString()}
              />
              <MetricCard
                icon={Clock3}
                label="Por atender"
                tone="warning"
                value={summary.warning.toString()}
              />
              <MetricCard
                icon={CheckCircle2}
                label="Total generado"
                tone="success"
                value={summary.total.toString()}
              />
            </section>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <CrudSection
                description="Documentos, firmas, solicitudes y tardanzas se convierten en tareas claras."
                eyebrow="Alertas automaticas"
                filters={
                  <div className="flex flex-wrap gap-2">
                    <FilterLink
                      active={!filters.status && !filters.priority}
                      href="/notificaciones"
                      label="Todas"
                    />
                    <FilterLink
                      active={filters.status === "UNREAD"}
                      href="/notificaciones?estado=UNREAD"
                      label="Sin leer"
                    />
                    <FilterLink
                      active={filters.status === "READ"}
                      href="/notificaciones?estado=READ"
                      label="Leidas"
                    />
                    <FilterLink
                      active={filters.priority === "WARNING"}
                      href="/notificaciones?prioridad=WARNING"
                      label="Por atender"
                    />
                    <FilterLink
                      active={filters.priority === "CRITICAL"}
                      href="/notificaciones?prioridad=CRITICAL"
                      label="Criticas"
                    />
                  </div>
                }
                title="Trabajo que el sistema detecta por ti"
              >
                <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-[#475467]">
                      {activeFilterLabel(filters)}
                    </p>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#667085]">
                      {notifications.length} cargadas
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {notifications.length > 0 ? (
                    notifications.map((notification, index) => (
                      <NotificationCard
                        index={index}
                        key={notification.id}
                        notification={notification}
                      />
                    ))
                  ) : (
                    <EmptyState
                      description="Cambia el filtro o espera nuevas alertas automaticas del sistema."
                      icon={BellRing}
                      title="No hay notificaciones con estos filtros"
                    />
                  )}
                </div>

                <NotificationsPagination
                  pagination={pagination}
                  filters={filters}
                />
              </CrudSection>
              <AttentionPanel filters={filters} summary={summary} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AttentionPanel({
  filters,
  summary,
}: {
  filters: { priority?: NotificationPriority; status?: NotificationStatus };
  summary: NotificationsSummary;
}) {
  const activeMode = activeFilterLabel(filters);
  const hasUrgentWork = summary.critical > 0 || summary.warning > 0;

  return (
    <aside className="rounded-2xl border border-[#e1e5eb] bg-white p-5 text-[#1f242d] shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
        Lectura rapida
      </p>
      <h3 className="mt-2 text-xl font-semibold">
        Que debe atender RRHH primero
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#667085]">
        Esta bandeja convierte eventos automaticos en tareas claras para no
        revisar modulo por modulo.
      </p>

      <div className="mt-5 space-y-3">
        <DarkNoticeRow label="Vista actual" value={activeMode} />
        <DarkNoticeRow
          label="Criticas abiertas"
          value={summary.critical.toString()}
        />
        <DarkNoticeRow label="Por atender" value={summary.warning.toString()} />
      </div>

      <div className="mt-5 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
        <p className="text-sm font-semibold">
          {hasUrgentWork ? "Hay acciones pendientes" : "Todo se ve controlado"}
        </p>
        <p className="mt-2 text-xs leading-5 text-[#667085]">
          {hasUrgentWork
            ? "Empieza por criticas, luego documentos por vencer y solicitudes pendientes."
            : "Cuando aparezcan vencimientos, firmas o solicitudes, el sistema las mostrara aqui."}
        </p>
      </div>
    </aside>
  );
}

function DarkNoticeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#667085]">
        {label}
      </p>
      <p className="mt-1 whitespace-normal break-words text-base font-semibold leading-5 text-[#1f242d]">
        {value}
      </p>
    </div>
  );
}

function NotificationCard({
  index,
  notification,
}: {
  index: number;
  notification: AppNotification;
}) {
  const Icon = notificationIcon(notification.type);
  const unread = notification.status === "UNREAD";

  return (
    <article
      className={`animate-rise rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(16,24,40,0.08)] ${
        unread
          ? "border-[#818cf8] bg-[#fbfcff]"
          : "border-[#e1e5eb] bg-[#fbfcfd]"
      }`}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${priorityIconClass(notification.priority)}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="whitespace-normal break-words text-base font-semibold leading-5">
                {notification.title}
              </h3>
              <Badge tone={priorityBadgeTone(notification.priority)}>
                {priorityLabel(notification.priority)}
              </Badge>
            </div>
            <p className="mt-1 whitespace-normal break-words text-sm leading-6 text-[#475467]">
              {notification.message}
            </p>
            <p className="mt-2 whitespace-normal break-words text-xs font-medium leading-4 text-[#667085]">
              {notification.company?.name ?? "Grupo completo"} ·{" "}
              {formatDateTime(notification.generatedAt)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {notification.actionHref ? (
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#4f46e5] px-3 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)] transition hover:bg-[#4338ca]"
              href={notification.actionHref}
            >
              Revisar
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          <NotificationReadButton
            notificationId={notification.id}
            read={!unread}
          />
        </div>
      </div>
    </article>
  );
}

function FilterLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      className={`inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold transition ${
        active
          ? "bg-[#4f46e5] text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)]"
          : "border border-[#e1e5eb] bg-white text-[#475467] hover:bg-[#f8fafc]"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}

function NotificationsPagination({
  filters,
  pagination,
}: {
  filters: {
    cursor?: string;
    priority?: NotificationPriority;
    status?: NotificationStatus;
  };
  pagination: NotificationsPagination;
}) {
  return (
    <CursorPagination
      className="mt-5"
      firstHref={notificationPageHref(filters)}
      hasNextPage={pagination.hasNextPage}
      nextHref={notificationPageHref(
        filters,
        pagination.nextCursor ?? undefined,
      )}
      totalLabel={notificationCursorLabel(
        filters.cursor,
        pagination.hasNextPage,
      )}
    />
  );
}

function activeFilterLabel(filters: {
  priority?: NotificationPriority;
  status?: NotificationStatus;
}) {
  if (filters.status === "UNREAD") return "Mostrando alertas sin leer";
  if (filters.status === "READ") return "Mostrando alertas leidas";
  if (filters.priority === "CRITICAL") return "Mostrando alertas criticas";
  if (filters.priority === "WARNING") return "Mostrando alertas por atender";

  return "Mostrando todas las alertas";
}

function notificationPageHref(
  filters: {
    priority?: NotificationPriority;
    status?: NotificationStatus;
  },
  cursor?: string,
) {
  const query = new URLSearchParams();

  if (cursor) {
    query.set("cursor", cursor);
  }

  if (filters.priority) {
    query.set("prioridad", filters.priority);
  }

  if (filters.status) {
    query.set("estado", filters.status);
  }

  return `/notificaciones?${query.toString()}`;
}

function notificationCursorLabel(
  cursor: string | undefined,
  hasNextPage: boolean,
) {
  if (cursor) {
    return hasNextPage
      ? "Pagina cargada · hay mas alertas"
      : "Ultima pagina de alertas";
  }

  return hasNextPage
    ? "Primeras alertas cargadas · hay mas resultados"
    : "Todas las alertas filtradas estan visibles";
}

function notificationIcon(type: AppNotification["type"]) {
  const icons = {
    ANNOUNCEMENT_PUBLISHED: Megaphone,
    ATTENDANCE_LATE: MapPin,
    DOCUMENT_EXPIRED: FileWarning,
    DOCUMENT_EXPIRING: FileClock,
    DOCUMENT_PENDING_SIGNATURE: FileSignature,
    REQUEST_PENDING: Clock3,
  };

  return icons[type];
}

function priorityLabel(priority: NotificationPriority) {
  const labels = {
    CRITICAL: "Critica",
    INFO: "Info",
    WARNING: "Atender",
  };

  return labels[priority];
}

function priorityBadgeTone(priority: NotificationPriority) {
  const tones = {
    CRITICAL: "danger",
    INFO: "brand",
    WARNING: "warning",
  };

  return tones[priority] as "brand" | "danger" | "warning";
}

function priorityIconClass(priority: NotificationPriority) {
  const classes = {
    CRITICAL: "bg-[#fee4e2] text-[#b42318]",
    INFO: "bg-[#eef2ff] text-[#4f46e5]",
    WARNING: "bg-[#fff7df] text-[#b86b00]",
  };

  return classes[priority];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
