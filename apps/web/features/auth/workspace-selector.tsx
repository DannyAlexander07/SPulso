import { Building2, ChevronRight, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import type { AuthUser } from "./types";

export function WorkspaceSelector({ user }: { user: AuthUser }) {
  const canOpenAdmin = Boolean(user.access?.admin);
  const canOpenPortal = Boolean(user.access?.portal);

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,#eef2ff_0,#f4f6f8_34%,#eef2f7_100%)] px-4 py-6 text-[#171b23] sm:px-6">
      <section className="mx-auto flex min-h-[calc(100dvh-48px)] max-w-6xl flex-col justify-center">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4f46e5] text-sm font-bold text-white shadow-[0_18px_38px_rgba(79,70,229,0.24)]">
              SP
            </div>
            <div>
              <p className="text-lg font-semibold">SPulso</p>
              <p className="text-sm text-[#667085]">Selecciona tu espacio</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-[#dfe5ee] bg-white/90 px-4 py-2 text-sm font-semibold text-[#475467] shadow-sm sm:inline-flex">
            {user.firstName} {user.lastName}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">Acceso disponible</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-[42px]">
              Elige el espacio de trabajo.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">
              Cada panel muestra herramientas distintas segun tu rol. Puedes volver a cambiar de espacio desde el sistema.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#dfe5ee] bg-white/88 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.075)] backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f46e5]">
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-sm font-semibold leading-5">{user.firstName} {user.lastName}</p>
                <p className="mt-0.5 text-xs text-[#667085]">{user.role?.name ?? "Usuario del sistema"}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AccessPill label="Administrativo" active={canOpenAdmin} />
              <AccessPill label="Trabajador" active={canOpenPortal} />
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <WorkspaceCard
            description="Gestiona empresas, trabajadores, asistencia, documentos, beneficios, usuarios y automatizaciones."
            disabled={!canOpenAdmin}
            href="/"
            icon={Building2}
            label="Panel administrativo"
            meta={canOpenAdmin ? "Disponible segun tus permisos" : "Sin acceso administrativo"}
          />
          <WorkspaceCard
            description="Marca asistencia, revisa tu ficha, solicitudes, documentos, beneficios y tu equipo."
            disabled={!canOpenPortal}
            href="/portal"
            icon={UserRound}
            label="Portal trabajador"
            meta={canOpenPortal ? "Disponible por trabajador vinculado" : "Sin trabajador vinculado"}
          />
        </div>
      </section>
    </main>
  );
}

function WorkspaceCard({
  description,
  disabled,
  href,
  icon: Icon,
  label,
  meta,
}: {
  description: string;
  disabled: boolean;
  href: string;
  icon: React.ElementType;
  label: string;
  meta: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${disabled ? "bg-[#f2f4f7] text-[#98a2b3]" : "bg-[#eef2ff] text-[#4f46e5]"}`}>
          <Icon className="h-6 w-6" />
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${disabled ? "bg-[#f2f4f7] text-[#98a2b3]" : "bg-[#e0f2fe] text-[#0284c7]"}`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {disabled ? "Bloqueado" : "Activo"}
        </span>
      </div>
      <div className="mt-7">
        <p className="text-2xl font-semibold">{label}</p>
        <p className="mt-2 text-sm leading-6 text-[#667085]">{description}</p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">{meta}</p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-[#e1e5eb] pt-4 text-sm font-bold text-[#4f46e5]">
        Entrar
        <ChevronRight className="h-5 w-5" />
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className="rounded-[24px] border border-[#dfe5ee] bg-white/60 p-5 opacity-70 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <Link className="group rounded-[24px] border border-[#dfe5ee] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#818cf8] hover:shadow-[0_24px_70px_rgba(16,24,40,0.12)]" href={href}>
      {content}
    </Link>
  );
}

function AccessPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-2xl px-3 py-2 text-center text-xs font-bold ${
        active ? "bg-[#eef2ff] text-[#4f46e5]" : "bg-[#f2f4f7] text-[#98a2b3]"
      }`}
    >
      {label}
    </span>
  );
}
