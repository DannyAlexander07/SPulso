"use client";

import {
  Building2,
  CalendarCheck,
  ChevronDown,
  Clock3,
  FileDown,
  FileText,
  History,
  LayoutDashboard,
  MapPinCheck,
  BellRing,
  Megaphone,
  Gift,
  Network,
  Sparkles,
  UserCog,
  UsersRound,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  canViewAutomations,
  canViewAnnouncements,
  canViewAttendance,
  canViewAudit,
  canViewBenefits,
  canViewCompanies,
  canViewDocuments,
  canViewEmployees,
  canViewNotifications,
  canViewOrganization,
  canViewRequests,
  canViewReports,
  canManageUsers,
} from "@/features/auth/permissions";
import { LogoutButton } from "@/features/auth/logout-button";
import type { AuthUser } from "@/features/auth/types";
import type { ElementType } from "react";
import { useEffect, useState } from "react";

type NavigationItem = {
  href: string;
  icon: ElementType;
  label: string;
  visible: (user: AuthUser | null) => boolean;
};

type NavigationGroup = {
  eyebrow: string;
  icon: ElementType;
  items: NavigationItem[];
  label: string;
};

const navigationGroups: NavigationGroup[] = [
  {
    eyebrow: "Operar",
    icon: LayoutDashboard,
    label: "Inicio",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard, visible: () => true }],
  },
  {
    eyebrow: "RRHH",
    icon: UsersRound,
    label: "Personas",
    items: [
      { label: "Trabajadores", href: "/trabajadores", icon: UsersRound, visible: canViewEmployees },
      { label: "Organizacion", href: "/organizacion", icon: Network, visible: canViewOrganization },
      { label: "Usuarios y roles", href: "/usuarios", icon: UserCog, visible: canManageUsers },
    ],
  },
  {
    eyebrow: "Control",
    icon: CalendarCheck,
    label: "Tiempo",
    items: [
      { label: "Asistencia", href: "/asistencia", icon: CalendarCheck, visible: canViewAttendance },
      { label: "Solicitudes", href: "/solicitudes", icon: Clock3, visible: canViewRequests },
    ],
  },
  {
    eyebrow: "Archivo",
    icon: FileText,
    label: "Documentos",
    items: [
      { label: "Documentos", href: "/documentos", icon: FileText, visible: canViewDocuments },
      { label: "Mis reportes", href: "/reportes", icon: FileDown, visible: canViewReports },
    ],
  },
  {
    eyebrow: "Cultura",
    icon: Megaphone,
    label: "Comunicaciones",
    items: [
      { label: "Comunicados", href: "/comunicados", icon: Megaphone, visible: canViewAnnouncements },
      { label: "Beneficios", href: "/beneficios", icon: Gift, visible: canViewBenefits },
      { label: "Notificaciones", href: "/notificaciones", icon: BellRing, visible: canViewNotifications },
    ],
  },
  {
    eyebrow: "Sistema",
    icon: Sparkles,
    label: "Automatizacion",
    items: [
      { label: "Automatizaciones", href: "/automatizaciones", icon: Sparkles, visible: canViewAutomations },
      { label: "Auditoria", href: "/auditoria", icon: History, visible: canViewAudit },
    ],
  },
  {
    eyebrow: "Base",
    icon: Building2,
    label: "Configuracion",
    items: [{ label: "Empresas", href: "/empresas", icon: Building2, visible: canViewCompanies }],
  },
];

const utilityNavigation = [
  { label: "Marcacion", href: "/marcacion", icon: MapPinCheck },
];

export function AppSidebar({
  activePath = "/",
  currentUser,
}: {
  activePath?: string;
  currentUser?: AuthUser | null;
}) {
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible(currentUser ?? null)),
    }))
    .filter((group) => group.items.length > 0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) {
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
  }, [mobileMenuOpen]);

  return (
    <>
      <button
        aria-label="Abrir menu"
        className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dfe5ec] bg-white text-[#4f46e5] shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:bg-[#eef2ff] lg:hidden"
        onClick={() => setMobileMenuOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="hidden border-r border-[#dfe5ec] bg-white/92 px-3 py-4 shadow-[10px_0_36px_rgba(15,23,42,0.03)] backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 px-1">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#4f46e5] text-sm font-bold text-white shadow-[0_12px_26px_rgba(79,70,229,0.18)]">
            SP
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#38bdf8]" />
          </div>
          <div>
            <p className="text-[14px] font-semibold leading-5">SPulso</p>
            <p className="text-xs text-[#667085]">People operations</p>
          </div>
        </div>

        <nav className="mt-6 space-y-2.5 overflow-y-auto pr-1">
          {visibleGroups.map((group) => {
            const groupActive = group.items.some((item) => item.href === activePath);

            return (
              <details
                className="admin-nav-group group/sidebar rounded-[18px] border border-transparent bg-transparent transition open:border-[#dfe5ec] open:bg-white open:shadow-sm"
                key={group.label}
                open={groupActive}
              >
                <summary
                  className={`admin-nav-summary spulso-interactive flex h-10 cursor-pointer list-none items-center justify-between rounded-[14px] px-2.5 text-[var(--foreground)] transition hover:translate-x-0.5 hover:bg-[var(--surface-muted)] hover:text-[var(--brand)] [&::-webkit-details-marker]:hidden ${
                    groupActive ? "admin-nav-summary-active" : "admin-nav-summary-inactive"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[11px] ${
                        groupActive
                          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                          : "bg-[var(--surface-muted)] text-[var(--muted)]"
                      }`}
                    >
                      <group.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] leading-4 text-[#98a2b3]">{group.eyebrow}</p>
                      <p className="truncate text-[13px] font-semibold">{group.label}</p>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#98a2b3] transition group-open/sidebar:rotate-180" />
                </summary>

                <div className="mx-2 mb-2.5 mt-1.5 space-y-1 border-l border-[#dfe5ec] pl-2">
                  {group.items.map((item) => {
                    const active = item.href === activePath;

                    return (
                      <Link
                        className={`admin-nav-item spulso-interactive flex h-9 items-center gap-2.5 rounded-[12px] px-2.5 text-[13px] font-medium transition duration-200 ${
                          active
                            ? "bg-[var(--brand-soft)] text-[var(--brand)] shadow-sm"
                            : "text-[var(--muted-strong)] hover:translate-x-1 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] hover:shadow-sm"
                        } ${active ? "admin-nav-active" : "admin-nav-inactive"}`}
                        href={item.href}
                        key={item.label}
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </nav>

        <div className="mt-5 border-t border-[#dfe5ec] pt-4">
          {utilityNavigation.map((item) => (
            <Link
              className="admin-nav-item admin-nav-inactive spulso-interactive group flex h-9 items-center gap-2.5 rounded-[12px] px-2.5 text-[13px] font-medium text-[var(--muted-strong)] transition duration-200 hover:translate-x-1 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
              href={item.href}
              key={item.label}
              target="_blank"
            >
              <item.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mt-auto rounded-[16px] border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-muted)] text-[var(--muted-strong)]">
            <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">Estado operativo</p>
              <p className="truncate text-xs text-[var(--muted)]">Alertas y flujos activos</p>
            </div>
          </div>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 h-[100svh] overflow-hidden lg:hidden">
          <button
            aria-label="Fondo del menu"
            className="absolute inset-0 bg-[#101828]/45 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          />
          <aside className="fixed bottom-0 left-0 top-0 flex h-[100svh] max-h-[100svh] w-[min(88vw,360px)] flex-col overflow-hidden overscroll-contain border-r border-[#dfe5ec] bg-white shadow-[24px_0_70px_rgba(15,23,42,0.24)]">
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[#e1e5eb] px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#4f46e5] text-sm font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)]">
                  SP
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#38bdf8]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1f242d]">SPulso</p>
                  <p className="truncate text-xs text-[#667085]">Panel administrativo</p>
                </div>
              </div>
              <button
                aria-label="Cerrar menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfe5ec] bg-white text-[#475467] shadow-sm transition hover:bg-[#eef2ff] hover:text-[#4f46e5]"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4">
              {visibleGroups.map((group) => {
                const groupActive = group.items.some((item) => item.href === activePath);

                return (
                  <details
                    className="admin-nav-group group/sidebar rounded-2xl border border-[#dfe5ec] bg-[#fbfcfd] shadow-sm transition open:bg-white"
                    key={group.label}
                    open={groupActive}
                  >
                    <summary
                      className={`admin-nav-summary flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-3 py-2 text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand)] [&::-webkit-details-marker]:hidden ${
                        groupActive ? "admin-nav-summary-active" : "admin-nav-summary-inactive"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            groupActive
                              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                              : "bg-[var(--surface)] text-[var(--muted)]"
                          }`}
                        >
                          <group.icon className="h-4 w-4" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                            {group.eyebrow}
                          </p>
                          <p className="truncate text-sm font-semibold">{group.label}</p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#98a2b3] transition group-open/sidebar:rotate-180" />
                    </summary>

                    <div className="mx-3 mb-3 space-y-1 border-l border-[#dfe5ec] pl-3">
                      {group.items.map((item) => {
                        const active = item.href === activePath;

                        return (
                          <Link
                            className={`admin-nav-item flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                              active
                                ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                                : "text-[var(--muted-strong)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                            } ${active ? "admin-nav-active" : "admin-nav-inactive"}`}
                            href={item.href}
                            key={item.label}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <item.icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </nav>

            <div className="shrink-0 space-y-2 border-t border-[#e1e5eb] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              {utilityNavigation.map((item) => (
                <Link
                  className="flex h-11 items-center gap-3 rounded-xl bg-[#eef2ff] px-3 text-sm font-semibold text-[#4f46e5]"
                  href={item.href}
                  key={item.label}
                  onClick={() => setMobileMenuOpen(false)}
                  target="_blank"
                >
                  <item.icon className="h-4 w-4" strokeWidth={2.2} />
                  {item.label}
                </Link>
              ))}
              <div className="flex items-center justify-between rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#1f242d]">Sesion</p>
                  <p className="text-xs text-[#667085]">Panel administrativo</p>
                </div>
                <LogoutButton />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
