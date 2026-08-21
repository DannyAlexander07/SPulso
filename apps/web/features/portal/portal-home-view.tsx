"use client";

import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  Gift,
  Home,
  MapPin,
  Menu,
  Megaphone,
  ShieldCheck,
  Umbrella,
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

const portalModules = [
  { href: "/portal", icon: Home, label: "Inicio" },
  { href: "/portal/comunicados", icon: Megaphone, label: "Comunicados" },
  { href: "/portal/marcacion", icon: MapPin, label: "Marcacion" },
  { href: "/portal/documentos", icon: FileText, label: "Documentos" },
  { href: "/portal/solicitudes", icon: CalendarDays, label: "Solicitudes" },
  { href: "/portal/equipo", icon: UsersRound, label: "Mi equipo" },
  { href: "/portal/beneficios", icon: Gift, label: "Beneficios" },
  { href: "/portal/ficha", icon: UserRound, label: "Mi ficha" },
];

export function PortalHomeView({ profile }: { profile: PortalProfile }) {
  const { employee } = profile;
  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <main className="min-h-screen bg-[#eef2f7] text-[#171b23]">
      <div className="fixed inset-y-0 left-0 z-20 hidden w-[260px] border-r border-[#dfe5ee] bg-white lg:block" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
        <PortalSidebar employee={employee} fullName={fullName} />

        <section className="min-w-0 flex-1 px-3 pb-8 pt-3 sm:px-5 lg:ml-[260px] lg:pb-8 lg:pl-4 lg:pr-6">
          <TopBar
            employee={employee}
            fullName={fullName}
            themePreference={profile.themePreference ?? null}
          />

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-[20px] border border-[#dfe5ee] bg-white p-3.5 shadow-sm transition duration-200 hover:border-[#c8d2e0] hover:shadow-[0_14px_30px_rgba(15,23,42,0.055)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar avatarUrl={employee.user?.avatarUrl} firstName={employee.firstName} lastName={employee.lastName} size="lg" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Portal trabajador</p>
                    <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">{fullName}</h1>
                    <p className="mt-1 text-sm text-[#667085]">
                      {employee.position?.name ?? employee.jobTitle ?? "Trabajador"} · {employee.company.name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 lg:w-[500px]">
                  <HeroMetric label="Solicitudes" value={profile.summary.pendingRequests.toString()} />
                  <HeroMetric label="Docs" value={profile.summary.documentsToSign.toString()} />
                  <HeroMetric label="Beneficios" value={profile.summary.benefits.toString()} />
                  <HeroMetric label="Avisos" value={profile.summary.announcements.toString()} />
                  <HeroMetric label="Equipo" value={profile.summary.teamMembers.toString()} />
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <PortalAction href="/portal/marcacion" icon={Clock3} label="Marcar asistencia" description="Entrada o salida con GPS" primary />
              <PortalAction href="/cambiar-pin" icon={ShieldCheck} label="Cambiar PIN" description="Seguridad de marcacion" />
            </section>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Panel title="Accesos rapidos">
              <div className="grid gap-3 sm:grid-cols-2">
                <QuickCard href="/portal/solicitudes" icon={Umbrella} title="Pedir vacaciones" description="Solicita descanso o feriado legal." />
                <QuickCard href="/portal/solicitudes" icon={CalendarDays} title="Dar aviso" description="Trabajo remoto, ausencia o novedad." />
                <QuickCard href="/portal/documentos" icon={FileText} title="Mis documentos" description="Boletas, contratos y certificados." />
                <QuickCard href="/portal/equipo" icon={UsersRound} title="Mi equipo" description="Responsables y companeros." />
              </div>
            </Panel>

            <Panel title="Mi ficha" actionHref="/portal/ficha" actionLabel="Abrir ficha">
              <div className="space-y-2">
                <InfoRow label="Empresa" value={employee.company.name} />
                <InfoRow label="Area" value={employee.areaRef?.name ?? employee.area ?? "Pendiente"} />
                <InfoRow label="Jefe" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "Pendiente"} />
                <InfoRow label="Equipo" value={employee.team?.name ?? "Sin equipo"} />
              </div>
            </Panel>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Panel icon={Megaphone} title="Comunicados" actionHref="/portal/comunicados" actionLabel="Ver todos">
              <div className="space-y-3">
                {profile.announcements.slice(0, 3).map((announcement) => (
                  <AnnouncementItem announcement={announcement} key={announcement.id} />
                ))}
                {profile.announcements.length === 0 ? <EmptyText text="Aun no tienes comunicados disponibles." /> : null}
              </div>
            </Panel>

            <Panel icon={Gift} title="Beneficios para ti" actionHref="/portal/beneficios" actionLabel="Ver todos">
              <div className="space-y-3">
                {profile.benefits.slice(0, 3).map((benefit) => (
                  <BenefitItem key={benefit.id} benefit={benefit} />
                ))}
                {profile.benefits.length === 0 ? <EmptyText text="Aun no tienes beneficios disponibles." /> : null}
              </div>
            </Panel>

            <Panel icon={FileText} title="Documentos recientes" actionHref="/portal/documentos" actionLabel="Ver documentos">
              <div className="space-y-2">
                {profile.documents.slice(0, 5).map((document) => (
                  <ListItem key={document.id} meta={documentStatusLabel(document.status)} title={document.title} />
                ))}
                {profile.documents.length === 0 ? <EmptyText text="No tienes documentos por revisar." /> : null}
              </div>
            </Panel>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Panel icon={CalendarDays} title="Mis solicitudes" actionHref="/portal/solicitudes" actionLabel="Nueva solicitud">
              <div className="space-y-2">
                {profile.requests.slice(0, 5).map((request) => (
                  <ListItem key={request.id} meta={requestStatusLabel(request.status)} title={request.title} />
                ))}
                {profile.requests.length === 0 ? <EmptyText text="No tienes solicitudes registradas." /> : null}
              </div>
            </Panel>

            <Panel icon={UsersRound} title="Mi equipo" actionHref="/portal/equipo" actionLabel="Ver equipo">
              <div className="grid gap-2 sm:grid-cols-2">
                {profile.teamMembers.slice(0, 6).map((member) => (
                  <div className="flex items-center gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3" key={member.id}>
                    <Avatar firstName={member.firstName} lastName={member.lastName} />
                    <div className="min-w-0">
                      <p className="whitespace-normal break-words text-sm font-semibold leading-5">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="whitespace-normal break-words text-xs leading-4 text-[#667085]">{member.position?.name ?? member.jobTitle ?? "Sin cargo"}</p>
                    </div>
                  </div>
                ))}
                {profile.teamMembers.length === 0 ? <EmptyText text="Aun no tienes equipo asignado." /> : null}
              </div>
            </Panel>
          </div>
        </section>
      </div>

    </main>
  );
}

function PortalSidebar({
  employee,
  fullName,
}: {
  employee: PortalProfile["employee"];
  fullName: string;
}) {
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
          <Avatar avatarUrl={employee.user?.avatarUrl} firstName={employee.firstName} lastName={employee.lastName} />
          <div className="min-w-0">
            <p className="whitespace-normal break-words text-sm font-semibold leading-5">{fullName}</p>
            <p className="whitespace-normal break-words text-xs leading-4 text-[#667085]">{employee.company.name}</p>
          </div>
        </div>
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pb-36 pr-1">
        {portalModules.map((item) => (
          <ModuleLink key={item.href} {...item} active={item.href === "/portal"} />
        ))}
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

function TopBar({
  employee,
  fullName,
  themePreference,
}: {
  employee: PortalProfile["employee"];
  fullName: string;
  themePreference: PortalProfile["themePreference"] | null;
}) {
  return (
    <header className="flex items-center justify-between gap-2 rounded-[18px] border border-[#dfe5ee] bg-white px-3 py-2.5 shadow-sm sm:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav employee={employee} fullName={fullName} />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085] sm:text-xs">Inicio</p>
          <p className="truncate text-base font-semibold leading-5 sm:text-lg sm:leading-6">Panel del trabajador</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <ThemeToggle initialTheme={themePreference} userKey={employee.id} />
        <span className="hidden rounded-full bg-[#eef2ff] px-3 py-2 text-xs font-bold text-[#4f46e5] sm:inline-flex">
          {employee.company.name}
        </span>
        <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dfe5ee] bg-[#fbfcfd] text-[#475467]">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
        </span>
        <div className="hidden sm:block">
          <LogoutButton redirectTo="/login" />
        </div>
      </div>
    </header>
  );
}

function ModuleLink({
  active,
  href,
  icon: Icon,
  label,
}: {
  active?: boolean;
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      className={`flex items-center gap-3 rounded-[15px] px-3 py-2.5 text-sm font-semibold transition ${
        active ? "bg-[#eef2ff] text-[#4f46e5]" : "text-[#475467] hover:bg-[#f5f7fb] hover:text-[#171b23]"
      }`}
      href={href}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function MobileNav({
  employee,
  fullName,
}: {
  employee: PortalProfile["employee"];
  fullName: string;
}) {
  const [open, setOpen] = useState(false);

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
                <Avatar avatarUrl={employee.user?.avatarUrl} firstName={employee.firstName} lastName={employee.lastName} />
                <div className="min-w-0">
                  <p className="whitespace-normal break-words text-sm font-semibold leading-5">{fullName}</p>
                  <p className="truncate text-xs text-[#667085]">{employee.company.name}</p>
                </div>
              </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 py-4">
              {portalModules.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/portal";

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

function PortalAction({
  description,
  href,
  icon: Icon,
  label,
  primary = false,
}: {
  description: string;
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={`spulso-interactive flex min-h-20 items-center gap-3 rounded-[18px] border p-3.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
        primary
          ? "border-[#4f46e5] bg-[#4f46e5] text-white shadow-lg shadow-blue-500/20 hover:bg-[#184fe0]"
          : "border-[#dfe5ee] bg-white text-[#171b23] shadow-sm hover:border-[#818cf8]"
      }`}
      href={href}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] ${primary ? "bg-white/15" : "bg-[#eef2ff] text-[#4f46e5]"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        <span className={`mt-1 block text-xs font-medium leading-4 ${primary ? "text-white/80" : "text-[#667085]"}`}>{description}</span>
      </span>
    </Link>
  );
}

function QuickCard({ href, icon: Icon, title, description }: { href: string; icon: React.ElementType; title: string; description: string }) {
  return (
    <Link className="spulso-interactive flex items-center gap-3 rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-2.5 transition hover:-translate-y-0.5 hover:border-[#818cf8] hover:bg-white" href={href}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5">{title}</span>
        <span className="mt-0.5 block whitespace-normal break-words text-xs leading-4 text-[#667085]">{description}</span>
      </span>
    </Link>
  );
}

function Panel({
  actionHref,
  actionLabel,
  children,
  icon: Icon,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
  icon?: React.ElementType;
  title: string;
}) {
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
        {actionHref && actionLabel ? (
          <Link
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#4f46e5] transition hover:bg-[#eef2ff]"
            href={actionHref}
          >
            {actionLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BenefitItem({ benefit }: { benefit: PortalProfile["benefits"][number] }) {
  return (
    <div className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition hover:border-[#c8d2e0] hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-sm font-semibold leading-5">{benefit.title}</p>
          <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">{benefit.category}</p>
        </div>
        {benefit.isHighlighted ? <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#4f46e5]">Destacado</span> : null}
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#667085]">{benefit.description}</p>
    </div>
  );
}

function AnnouncementItem({ announcement }: { announcement: PortalProfile["announcements"][number] }) {
  const tones = {
    IMPORTANT: "bg-[#fff7df] text-[#b86b00]",
    NORMAL: "bg-[#eef2ff] text-[#4f46e5]",
    URGENT: "bg-[#fee4e2] text-[#b42318]",
  };
  const labels = { IMPORTANT: "Importante", NORMAL: "Aviso", URGENT: "Urgente" };

  return (
    <div className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition hover:border-[#c8d2e0] hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-sm font-semibold leading-5">{announcement.title}</p>
          <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">
            {announcement.audienceScope === "ALL" ? "Grupo" : announcement.audienceScope === "COMPANIES" ? "Empresa" : "Equipo"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[announcement.priority]}`}>
          {labels[announcement.priority]}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#667085]">{announcement.message}</p>
      {announcement.imageUrl ? (
        <img
          alt=""
          className="mt-3 aspect-[16/7] w-full rounded-xl border border-[#e1e5eb] object-cover"
          src={mediaUrl(announcement.imageUrl)}
        />
      ) : null}
    </div>
  );
}

function ListItem({ meta, title }: { meta: string; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition hover:border-[#c8d2e0] hover:bg-white">
      <div className="min-w-0">
        <p className="whitespace-normal break-words text-sm font-semibold leading-5">{title}</p>
        <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">{meta}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-[#fbfcfd] px-3 py-2">
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-2.5">
      <p className="text-lg font-semibold text-[#4f46e5]">{value}</p>
      <p className="mt-1 whitespace-normal text-[11px] font-semibold leading-4 text-[#667085]">{label}</p>
    </div>
  );
}

function Avatar({
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

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[#d8dee8] p-4 text-sm text-[#667085]">{text}</p>;
}

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    APPROVED: "Aprobada",
    CANCELLED: "Cancelada",
    PENDING: "Pendiente",
    REJECTED: "Rechazada",
  };

  return labels[status] ?? status;
}

function documentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    EXPIRED: "Vencido",
    PENDING_SIGNATURE: "Pendiente de firma",
    SIGNED: "Firmado",
  };

  return labels[status] ?? status;
}
