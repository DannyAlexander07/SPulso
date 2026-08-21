"use client";

import {
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Gift,
  Home,
  MapPin,
  Menu,
  Megaphone,
  ShieldCheck,
  XCircle,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/features/auth/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { mediaUrl } from "@/lib/api";
import type { PortalProfile } from "./types";
import { useEffect, useState } from "react";

export const portalModules = [
  { href: "/portal", icon: Home, label: "Inicio" },
  { href: "/portal/comunicados", icon: Megaphone, label: "Comunicados" },
  { href: "/portal/marcacion", icon: MapPin, label: "Marcacion" },
  { href: "/portal/documentos", icon: FileText, label: "Documentos" },
  { href: "/portal/solicitudes", icon: CalendarDays, label: "Solicitudes" },
  { href: "/portal/equipo", icon: UsersRound, label: "Mi equipo" },
  { href: "/portal/beneficios", icon: Gift, label: "Beneficios" },
  { href: "/portal/ficha", icon: UserRound, label: "Mi ficha" },
];

export type PortalPanelIcon =
  | "benefits"
  | "building"
  | "documents"
  | "requests"
  | "security"
  | "user"
  | "users"
  | "announcements";

const portalPanelIcons = {
  announcements: Megaphone,
  benefits: Gift,
  building: Building2,
  documents: FileText,
  requests: CalendarDays,
  security: ShieldCheck,
  user: UserRound,
  users: UsersRound,
} satisfies Record<PortalPanelIcon, React.ElementType>;

export function PortalShell({
  activePath,
  children,
  profile,
  title,
}: {
  activePath: string;
  children: React.ReactNode;
  profile: PortalProfile;
  title: string;
}) {
  const fullName = `${profile.employee.firstName} ${profile.employee.lastName}`;
  const notifications = buildPortalNotifications(profile);
  const unreadNotifications = notifications.filter((notification) => notification.unread).length;

  return (
    <main className="min-h-screen bg-[#eef2f7] text-[#171b23]">
      <div className="fixed inset-y-0 left-0 z-20 hidden w-[260px] border-r border-[#dfe5ee] bg-white lg:block" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
        <PortalSidebar activePath={activePath} profile={profile} />
        <section className="min-w-0 flex-1 px-3 pb-8 pt-3 sm:px-5 lg:ml-[260px] lg:pb-8 lg:pl-4 lg:pr-6">
          <header className="flex items-center justify-between gap-2 rounded-[18px] border border-[#dfe5ee] bg-white px-3 py-2.5 shadow-sm sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <PortalMobileMenu activePath={activePath} profile={profile} />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085] sm:text-xs">{title}</p>
                <p className="truncate text-base font-semibold leading-5 sm:text-lg sm:leading-6">Panel del trabajador</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle
                initialTheme={profile.themePreference ?? null}
                userKey={profile.employee.id}
              />
              <span className="hidden rounded-full bg-[#eef2ff] px-3 py-2 text-xs font-bold text-[#4f46e5] sm:inline-flex">
                {profile.employee.company.name}
              </span>
              <PortalNotificationsBell notifications={notifications} unread={unreadNotifications} />
              <div className="hidden sm:block">
                <LogoutButton redirectTo="/login" />
              </div>
            </div>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}

type PortalNotificationItem = {
  href: string;
  icon: React.ElementType;
  message: string;
  tone: "blue" | "green" | "red" | "amber";
  title: string;
  unread: boolean;
};

function PortalNotificationsBell({
  notifications,
  unread,
}: {
  notifications: PortalNotificationItem[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-label="Ver notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dfe5ee] bg-[#fbfcfd] text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            aria-label="Cerrar notificaciones"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(88vw,360px)] overflow-hidden rounded-[20px] border border-[#dfe5ee] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="border-b border-[#e1e5eb] bg-[#f8fafc] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1f242d]">Notificaciones</p>
                  <p className="text-xs text-[#667085]">
                    {unread > 0 ? `${unread} pendiente${unread === 1 ? "" : "s"}` : "Todo al dia"}
                  </p>
                </div>
                {unread > 0 ? (
                  <span className="rounded-full bg-[#fee4e2] px-2.5 py-1 text-xs font-bold text-[#b42318]">
                    {unread}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2">
              {notifications.length > 0 ? (
                notifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <Link
                      className="flex gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[#f8fafc]"
                      href={notification.href}
                      key={`${notification.href}-${notification.title}-${notification.message}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notificationTone(notification.tone)}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="whitespace-normal break-words text-sm font-semibold leading-5 text-[#1f242d]">{notification.title}</span>
                          {notification.unread ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#38bdf8]" /> : null}
                        </span>
                        <span className="mt-1 block whitespace-normal break-words text-xs leading-5 text-[#667085]">{notification.message}</span>
                      </span>
                    </Link>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-[#d8dee8] p-4 text-sm text-[#667085]">
                  No tienes notificaciones por ahora.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function buildPortalNotifications(profile: PortalProfile): PortalNotificationItem[] {
  const documentItems = profile.documents
    .filter((document) => document.status === "PENDING_SIGNATURE")
    .map((document) => ({
      href: "/portal/documentos",
      icon: FileText,
      message: document.title,
      tone: "blue" as const,
      title: "Documento por firmar",
      unread: true,
    }));

  const requestItems = profile.requests
    .filter((request) => ["APPROVED", "REJECTED", "PENDING"].includes(request.status))
    .slice(0, 4)
    .map((request) => ({
      href: "/portal/solicitudes",
      icon: request.status === "APPROVED" ? CheckCircle2 : request.status === "REJECTED" ? XCircle : CalendarDays,
      message: request.title,
      tone: request.status === "APPROVED" ? ("green" as const) : request.status === "REJECTED" ? ("red" as const) : ("amber" as const),
      title:
        request.status === "APPROVED"
          ? "Solicitud aprobada"
          : request.status === "REJECTED"
            ? "Solicitud rechazada"
            : "Solicitud pendiente",
      unread: request.status !== "PENDING",
    }));

  const announcementItems = profile.announcements
    .filter((announcement) => !announcement.readAt)
    .slice(0, 4)
    .map((announcement) => ({
      href: "/portal/comunicados",
      icon: Megaphone,
      message: announcement.title,
      tone: announcement.priority === "URGENT" ? ("red" as const) : announcement.priority === "IMPORTANT" ? ("amber" as const) : ("blue" as const),
      title: "Comunicado nuevo",
      unread: true,
    }));

  return [...documentItems, ...requestItems, ...announcementItems].slice(0, 10);
}

function notificationTone(tone: PortalNotificationItem["tone"]) {
  const tones = {
    amber: "bg-[#fffbeb] text-[#b45309]",
    blue: "bg-[#eef2ff] text-[#4f46e5]",
    green: "bg-[#ecfdf3] text-[#027a48]",
    red: "bg-[#fee4e2] text-[#b42318]",
  };

  return tones[tone];
}

function PortalSidebar({ activePath, profile }: { activePath: string; profile: PortalProfile }) {
  const { employee } = profile;
  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen min-h-screen w-[260px] shrink-0 flex-col border-r border-[#dfe5ee] bg-white p-4 lg:flex">
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4f46e5] text-sm font-bold text-white">SP</span>
        <div>
          <p className="font-semibold">SPulso</p>
          <p className="text-xs text-[#667085]">Portal trabajador</p>
        </div>
      </div>

      <div className="mt-5 shrink-0 rounded-[18px] border border-[#dfe5ee] bg-[#fbfcfd] p-3">
        <div className="flex items-center gap-3">
          <PortalAvatar avatarUrl={employee.user?.avatarUrl} firstName={employee.firstName} lastName={employee.lastName} />
          <div className="min-w-0">
            <p className="whitespace-normal break-words text-sm font-semibold leading-5">{fullName}</p>
            <p className="whitespace-normal break-words text-xs leading-4 text-[#667085]">{employee.company.name}</p>
          </div>
        </div>
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pb-36 pr-1">
        {portalModules.map((item) => {
          const Icon = item.icon;
          const active = item.href === activePath;

          return (
            <Link
              className={`portal-nav-item spulso-interactive flex items-center gap-3 rounded-[15px] px-3 py-2.5 text-sm font-semibold transition ${
                active ? "bg-[#eef2ff] text-[#4f46e5]" : "text-[#475467] hover:translate-x-1 hover:bg-[#eef2ff] hover:text-[#4f46e5]"
              } ${active ? "portal-nav-active" : "portal-nav-inactive"}`}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="fixed bottom-4 left-4 z-40 hidden w-[228px] border-t border-[#e1e5eb] pt-4 lg:block">
        <div className="rounded-[16px] bg-[#fbfcfd] px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-sm font-semibold">Sesion</p>
            <p className="text-xs text-[#667085]">Portal trabajador</p>
          </div>
          <div className="mt-3">
            <LogoutButton redirectTo="/login" showLabel />
          </div>
        </div>
      </div>
    </aside>
  );
}

function PortalMobileMenu({
  activePath,
  profile,
}: {
  activePath: string;
  profile: PortalProfile;
}) {
  const [open, setOpen] = useState(false);
  const fullName = `${profile.employee.firstName} ${profile.employee.lastName}`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        aria-label="Abrir menu del portal"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#dfe5ee] bg-white text-[#475467] shadow-sm transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 h-[100svh] overflow-hidden lg:hidden">
          <button
            aria-label="Cerrar menu"
            className="absolute inset-0 bg-[#101828]/45 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside className="fixed bottom-0 left-0 top-0 flex h-[100svh] max-h-[100svh] w-[min(88vw,360px)] flex-col overflow-hidden overscroll-contain border-r border-[#dfe5ee] bg-white shadow-[24px_0_70px_rgba(15,23,42,0.24)]">
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[#e1e5eb] px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#4f46e5] text-sm font-bold text-white">
                  SP
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1f242d]">SPulso</p>
                  <p className="truncate text-xs text-[#667085]">Portal trabajador</p>
                </div>
              </div>
              <button
                aria-label="Cerrar menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfe5ee] bg-white text-[#475467] shadow-sm transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-4 mt-4 shrink-0 rounded-[18px] border border-[#dfe5ee] bg-[#fbfcfd] p-3">
              <div className="flex min-w-0 items-center gap-3">
                <PortalAvatar
                  avatarUrl={profile.employee.user?.avatarUrl}
                  firstName={profile.employee.firstName}
                  lastName={profile.employee.lastName}
                />
                <div className="min-w-0">
                  <p className="whitespace-normal break-words text-sm font-semibold leading-5">{fullName}</p>
                  <p className="truncate text-xs text-[#667085]">{profile.employee.company.name}</p>
                </div>
              </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 py-4">
              {portalModules.map((item) => {
                const Icon = item.icon;
                const active = item.href === activePath;

                return (
                  <Link
                    className={`portal-nav-item spulso-interactive flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                      active
                        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "text-[var(--muted-strong)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                    } ${active ? "portal-nav-active" : "portal-nav-inactive"}`}
                    href={item.href}
                    key={item.href}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 border-t border-[#e1e5eb] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between rounded-[16px] bg-[#fbfcfd] px-3 py-3">
                <div>
                  <p className="text-sm font-semibold">Sesion</p>
                  <p className="text-xs text-[#667085]">Portal trabajador</p>
                </div>
                <LogoutButton redirectTo="/login" />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function PortalPanel({
  action,
  children,
  icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon?: PortalPanelIcon;
  title: string;
}) {
  const Icon = icon ? portalPanelIcons[icon] : null;

  return (
    <section className="rounded-[18px] border border-[#dfe5ee] bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#c8d2e0] hover:shadow-[0_14px_30px_rgba(15,23,42,0.055)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <h2 className="whitespace-normal break-words text-base font-semibold leading-5">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PortalAvatar({
  avatarUrl,
  firstName,
  lastName,
  size = "md",
}: {
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-16 w-16 text-lg" : "h-10 w-10 text-xs";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef2ff] font-bold text-[#4f46e5] ${sizeClass}`}
    >
      {avatarUrl ? (
        <img alt={`${firstName} ${lastName}`} className="h-full w-full object-cover" src={mediaUrl(avatarUrl)} />
      ) : (
        `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase()
      )}
    </span>
  );
}

export function PortalEmpty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[#d8dee8] p-4 text-sm text-[#667085]">{text}</p>;
}

export function PortalChevronAction({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4f46e5]">
      {label}
      <ChevronRight className="h-4 w-4" />
    </span>
  );
}
