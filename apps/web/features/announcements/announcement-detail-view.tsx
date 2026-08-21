import { ArrowLeft, CheckCircle2, Clock3, Megaphone, UsersRound } from "lucide-react";
import Link from "next/link";
import { mediaUrl } from "@/lib/api";
import { AnnouncementEmailSendButton } from "./announcement-email-actions";
import type { AnnouncementDetail } from "./types";

export function AnnouncementDetailView({ announcement }: { announcement: AnnouncementDetail }) {
  const metrics = announcement.metrics;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-4">
      <section className="rounded-2xl border border-[#e1e5eb] bg-white p-5 shadow-sm">
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
          href="/comunicados"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a comunicados
        </Link>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
                {scopeLabel(announcement.audienceScope)}
              </span>
              <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-bold text-[#667085]">
                {announcement.status === "PUBLISHED" ? "Publicado" : announcement.status}
              </span>
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-normal">
              {announcement.title}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-[#667085]">{announcement.message}</p>
            {announcement.imageUrl ? (
              <img
                alt=""
                className="mt-5 aspect-[16/7] w-full max-w-4xl rounded-2xl border border-[#e1e5eb] object-cover"
                src={mediaUrl(announcement.imageUrl)}
              />
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {audienceTags(announcement).map((tag) => (
                <span className="rounded-full bg-[#fbfcfd] px-3 py-1 text-xs font-semibold text-[#475467]" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Confirmacion de lectura</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold text-[#4f46e5]">{metrics.readRate}%</p>
                <p className="mt-1 text-sm text-[#667085]">avance confirmado</p>
              </div>
              <Megaphone className="h-8 w-8 text-[#4f46e5]" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8edf5]">
              <div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${Math.min(100, metrics.readRate)}%` }} />
            </div>
            <div className="mt-4 grid gap-2">
              <MetricRow icon={UsersRound} label="Destinatarios" value={metrics.estimatedRecipients} />
              <MetricRow icon={CheckCircle2} label="Leidos" value={metrics.readCount} />
              <MetricRow icon={Clock3} label="Pendientes" value={metrics.pendingCount} />
            </div>
            <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Cola de correo</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniMetric label="Pendientes" value={announcement.emailQueue.pending} />
                <MiniMetric label="Enviados" value={announcement.emailQueue.sent} />
                <MiniMetric label="Sin correo" value={announcement.emailQueue.skipped} />
                <MiniMetric label="Fallidos" value={announcement.emailQueue.failed} />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#667085]">
                Modo actual: simulacion. Marca como enviados sin usar un proveedor SMTP real todavia.
              </p>
              <AnnouncementEmailSendButton
                announcementId={announcement.id}
                disabled={!announcement.sendEmail || announcement.status !== "PUBLISHED" || announcement.emailQueue.pending === 0}
                pending={announcement.emailQueue.pending}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <PeoplePanel
          emptyText="Todavia nadie confirmo lectura."
          people={announcement.readers.map((reader) => ({
            id: reader.employee.id,
            name: `${reader.employee.firstName} ${reader.employee.lastName}`,
            meta: `${reader.employee.company.name}${reader.employee.team ? ` · ${reader.employee.team.name}` : ""}`,
            extra: `Leido ${formatDateTime(reader.readAt)}`,
          }))}
          title="Ya leyeron"
        />
        <PeoplePanel
          emptyText="No hay trabajadores pendientes."
          people={announcement.pending.map((employee) => ({
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            meta: `${employee.company.name}${employee.team ? ` · ${employee.team.name}` : ""}`,
            extra: employee.personalEmail ?? "Sin correo personal",
          }))}
          title="Faltan por leer"
        />
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#fbfcfd] px-3 py-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] font-semibold text-[#667085]">{label}</p>
    </div>
  );
}

function MetricRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e1e5eb] bg-white px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#667085]">
        <Icon className="h-4 w-4 text-[#4f46e5]" />
        {label}
      </span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function PeoplePanel({
  emptyText,
  people,
  title,
}: {
  emptyText: string;
  people: Array<{ extra: string; id: string; meta: string; name: string }>;
  title: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e1e5eb] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-bold text-[#667085]">{people.length}</span>
      </div>
      <div className="mt-4 space-y-2">
        {people.map((person) => (
          <div className="flex flex-col gap-2 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 sm:flex-row sm:items-center sm:justify-between" key={person.id}>
            <div className="min-w-0">
              <p className="whitespace-normal break-words text-sm font-semibold leading-5">{person.name}</p>
              <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">{person.meta}</p>
            </div>
            <p className="max-w-full whitespace-normal break-words text-left text-xs font-semibold leading-4 text-[#667085] sm:max-w-[220px] sm:text-right">{person.extra}</p>
          </div>
        ))}
        {people.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-4 text-sm text-[#667085]">{emptyText}</p>
        ) : null}
      </div>
    </article>
  );
}

function scopeLabel(scope: AnnouncementDetail["audienceScope"]) {
  if (scope === "ALL") return "Todo el grupo";
  if (scope === "COMPANIES") return "Por empresas";
  if (scope === "TEAMS") return "Por equipos";
  return "Por trabajadores";
}

function audienceTags(announcement: AnnouncementDetail) {
  if (announcement.audienceScope === "ALL") return ["Grupo completo"];

  const tags = announcement.audiences.flatMap((audience) => {
    if (audience.company) return [audience.company.name];
    if (audience.team) return [`${audience.team.name} · ${audience.team.company.name}`];
    if (audience.employee) return [`${audience.employee.firstName} ${audience.employee.lastName} · ${audience.employee.company.name}`];
    return [];
  });

  return tags.length > 0 ? tags : ["Sin audiencia definida"];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
