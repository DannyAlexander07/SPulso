import { LogoutButton } from "@/features/auth/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  canViewCompanies,
  canViewNotifications,
} from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import { getNotificationsSummary } from "@/features/notifications/api";
import { mediaUrl } from "@/lib/api";
import { getServerToken } from "@/lib/server-auth";
import { Bell, Building2, ChevronRight } from "lucide-react";
import Link from "next/link";

export async function AppTopbar({
  eyebrow = "Dashboard",
  currentUser,
  title = "Centro operativo",
}: {
  eyebrow?: string;
  currentUser?: AuthUser | null;
  title?: string;
}) {
  const roleName = currentUser?.role?.name ?? "Sin rol";
  const displayName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
    : "Usuario";
  const workTitle =
    currentUser?.employee?.positionName ??
    currentUser?.employee?.jobTitle ??
    roleName;
  const userSubtitle = currentUser?.employee?.companyName
    ? `${workTitle} · ${currentUser.employee.companyName}`
    : workTitle;
  const canSeeNotifications = canViewNotifications(currentUser ?? null);
  const notificationSummary = canSeeNotifications
    ? await getNotificationsSummary(await getServerToken())
    : null;
  const unreadNotifications = notificationSummary?.unread ?? 0;

  return (
    <header className="sticky top-0 z-10 border-b border-[#dfe5ec] bg-white/86 px-3 py-2 pl-16 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-xl sm:pl-16 sm:pr-4 lg:px-5">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085] sm:text-xs">
            {eyebrow}
          </p>
          <h1 className="mt-0.5 truncate text-base font-semibold tracking-normal sm:text-lg">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle
            initialTheme={currentUser?.themePreference ?? null}
            userKey={currentUser?.email ?? currentUser?.id}
          />
          {canSeeNotifications ? (
            <Link
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5ec] bg-white text-[#475467] shadow-sm transition hover:border-[#4f46e5] hover:bg-[#f8fafc] hover:text-[#4f46e5]"
              href="/notificaciones"
              title="Ver notificaciones"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#d92d20] px-1 text-[10px] font-bold leading-none text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
          ) : null}
          <div className="hidden min-w-[150px] max-w-[240px] rounded-[14px] border border-[#dfe5ec] bg-white px-3 py-1.5 text-right shadow-sm lg:block">
            <div className="flex items-center justify-end gap-2">
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-semibold leading-4 text-[#1f242d]">
                  {displayName}
                </p>
                <p className="truncate text-[11px] leading-4 text-[#667085]">
                  {userSubtitle}
                </p>
              </div>
              {currentUser?.avatarUrl ? (
                <img
                  alt={displayName}
                  className="h-8 w-8 shrink-0 rounded-xl object-cover"
                  src={mediaUrl(currentUser.avatarUrl)}
                />
              ) : null}
            </div>
          </div>
          {canViewCompanies(currentUser ?? null) ? (
            <Link
              className="hidden h-9 items-center gap-2 rounded-[14px] bg-[#4f46e5] px-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(79,70,229,0.18)] transition hover:-translate-y-0.5 hover:bg-[#4338ca] sm:flex"
              href="/empresas"
              title="Cambiar o administrar grupo empresarial"
            >
              <Building2 className="h-4 w-4" />
              Grupo SP
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
          <div className="hidden sm:block">
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
