"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  History,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { EmployeeProfile } from "./types";

type TimelineEvent = EmployeeProfile["timelineEvents"][number];
type TimelineFilter = "ALL" | "ROLE" | "MANAGER" | "TEAM" | "STATUS" | "MOVE";

const PAGE_SIZE = 4;

const FILTERS: Array<{ label: string; value: TimelineFilter }> = [
  { label: "Todo", value: "ALL" },
  { label: "Cargos", value: "ROLE" },
  { label: "Jefes", value: "MANAGER" },
  { label: "Equipos", value: "TEAM" },
  { label: "Ingresos y ceses", value: "STATUS" },
  { label: "Movimientos", value: "MOVE" },
];

export function EmployeeLaborTimeline({ events }: { events: TimelineEvent[] }) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("ALL");
  const [page, setPage] = useState(1);

  const filteredEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, activeFilter)),
    [activeFilter, events],
  );
  const totalPages = Math.max(Math.ceil(filteredEvents.length / PAGE_SIZE), 1);
  const visibleEvents = filteredEvents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const lastEvent = events[0];

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  return (
    <section className="rounded-2xl border border-[#d9e0ea] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
            <History className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
              Historial laboral
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1f242d]">Linea de tiempo laboral</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Ingresos, ceses, ascensos, cambios de jefe, equipo y empresa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SummaryChip label="Movimientos" value={events.length} />
          <SummaryChip label="Vista" value={filteredEvents.length} />
          <SummaryChip label="Ultimo" value={lastEvent ? formatDate(lastEvent.effectiveDate ?? lastEvent.createdAt) : "Sin datos"} />
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <button
            className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
              activeFilter === filter.value
                ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5] shadow-sm"
                : "border-[#d9e0ea] bg-white text-[#526173] hover:border-[#b9c5d6]"
            }`}
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {visibleEvents.length > 0 ? (
          <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[18px] before:top-4 before:w-px before:bg-[#d9e0ea]">
            {visibleEvents.map((event) => (
              <TimelineRow event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-4 text-sm text-[#667085]">
            No hay movimientos para este filtro.
          </p>
        )}
      </div>

      {filteredEvents.length > PAGE_SIZE ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[#526173]">
            Pagina {page} de {totalPages} · mostrando {visibleEvents.length} de {filteredEvents.length}
          </p>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d9e0ea] bg-white px-3 py-2 text-sm font-semibold text-[#526173] shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page === 1}
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d9e0ea] bg-white px-3 py-2 text-sm font-semibold text-[#526173] shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page === totalPages}
              onClick={() => setPage((currentPage) => Math.min(currentPage + 1, totalPages))}
              type="button"
            >
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  return (
    <article className="relative pl-10">
      <span className={`absolute left-0 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl ${timelineIconTone(event.type)}`}>
        <TimelineIcon event={event} />
      </span>

      <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition hover:-translate-y-0.5 hover:border-[#cbd5e1] hover:bg-white hover:shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${timelineBadgeTone(event.type)}`}>
              {timelineTypeLabel(event.type)}
            </span>
            <h3 className="mt-2 whitespace-normal break-words text-sm font-semibold leading-5 text-[#1f242d]">
              {event.title}
            </h3>
            {event.description ? (
              <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-[#667085]">
                {event.description}
              </p>
            ) : null}
          </div>
          <span className="w-fit shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#526173] shadow-sm">
            {formatDate(event.effectiveDate ?? event.createdAt)}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MiniFact label="Empresa" value={event.company?.name ?? snapshotValue(event.newData, "company")} />
          <MiniFact label="Cargo" value={event.position?.name ?? snapshotValue(event.newData, "position")} />
          <MiniFact label="Equipo" value={event.team?.name ?? snapshotValue(event.newData, "team")} />
          <MiniFact
            label="Jefe"
            value={
              event.manager
                ? `${event.manager.firstName} ${event.manager.lastName}`
                : snapshotValue(event.newData, "manager")
            }
          />
        </div>

        {event.createdBy ? (
          <p className="mt-3 text-xs font-medium text-[#667085]">Registrado por {event.createdBy}</p>
        ) : null}
      </div>
    </article>
  );
}

function SummaryChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#1f242d]">{value}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e1e5eb] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-xs font-bold leading-4 text-[#344054]">{value}</p>
    </div>
  );
}

function TimelineIcon({ event }: { event: TimelineEvent }) {
  if (event.type === "MANAGER_CHANGED") return <ShieldCheck className="h-4 w-4" />;
  if (event.type === "TEAM_CHANGED") return <UsersRound className="h-4 w-4" />;
  if (event.type === "TRANSFERRED") return <Building2 className="h-4 w-4" />;
  if (event.type === "PROMOTED") return <BriefcaseBusiness className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
}

function matchesFilter(event: TimelineEvent, filter: TimelineFilter) {
  if (filter === "ALL") return true;
  if (filter === "ROLE") return event.type === "PROMOTED";
  if (filter === "MANAGER") return event.type === "MANAGER_CHANGED";
  if (filter === "TEAM") return event.type === "TEAM_CHANGED";
  if (filter === "STATUS") return ["HIRED", "REHIRED", "TERMINATED"].includes(event.type);
  return event.type === "TRANSFERRED";
}

function timelineTypeLabel(type: TimelineEvent["type"]) {
  return {
    HIRED: "Ingreso",
    MANAGER_CHANGED: "Jefe",
    PROFILE_UPDATED: "Ficha",
    PROMOTED: "Cargo",
    REHIRED: "Reingreso",
    TEAM_CHANGED: "Equipo",
    TERMINATED: "Cese",
    TRANSFERRED: "Movimiento",
  }[type];
}

function timelineBadgeTone(type: TimelineEvent["type"]) {
  return {
    HIRED: "bg-[#e0f2fe] text-[#0284c7]",
    MANAGER_CHANGED: "bg-[#eef2ff] text-[#4f46e5]",
    PROFILE_UPDATED: "bg-[#f2f4f7] text-[#667085]",
    PROMOTED: "bg-[#eef2ff] text-[#4f46e5]",
    REHIRED: "bg-[#e0f2fe] text-[#0284c7]",
    TEAM_CHANGED: "bg-[#eef2ff] text-[#4f46e5]",
    TERMINATED: "bg-[#fee4e2] text-[#b42318]",
    TRANSFERRED: "bg-[#fff7df] text-[#b86b00]",
  }[type];
}

function timelineIconTone(type: TimelineEvent["type"]) {
  return {
    HIRED: "bg-[#e0f2fe] text-[#0284c7]",
    MANAGER_CHANGED: "bg-[#eef2ff] text-[#4f46e5]",
    PROFILE_UPDATED: "bg-[#f2f4f7] text-[#667085]",
    PROMOTED: "bg-[#eef2ff] text-[#4f46e5]",
    REHIRED: "bg-[#e0f2fe] text-[#0284c7]",
    TEAM_CHANGED: "bg-[#eef2ff] text-[#4f46e5]",
    TERMINATED: "bg-[#fee4e2] text-[#b42318]",
    TRANSFERRED: "bg-[#fff7df] text-[#b86b00]",
  }[type];
}

function snapshotValue(snapshot: Record<string, unknown> | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" && value.trim() ? value : "Sin dato";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
