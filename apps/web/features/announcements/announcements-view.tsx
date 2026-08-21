"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { CrudSection } from "@/components/ui/crud-section";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, Surface } from "@/components/ui/surface";
import { canManageAnnouncements } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import type { OrganizationData } from "@/features/organization/types";
import { mediaUrl } from "@/lib/api";
import {
  BellRing,
  Building2,
  Check,
  Clock3,
  Eye,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createAnnouncement, updateAnnouncement, uploadAnnouncementImage } from "./api";
import type {
  Announcement,
  AnnouncementAudienceScope,
  AnnouncementPayload,
  AnnouncementPriority,
  AnnouncementsResult,
  AnnouncementStatus,
} from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function AnnouncementsWorkspace({
  announcements,
  companies,
  currentUser,
  organization,
}: {
  announcements: AnnouncementsResult;
  companies: Company[];
  currentUser: AuthUser | null;
  organization: OrganizationData;
}) {
  const canManage = canManageAnnouncements(currentUser);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const filtered = useMemo(() => {
    const search = normalizeText(query);

    return announcements.data.filter((item) => {
      const matchesQuery =
        !search ||
        normalizeText([item.title, item.message, item.priority, ...audienceTags(item)].join(" ")).includes(search);
      const matchesStatus = !status || item.status === status;
      const matchesScope = !scope || item.audienceScope === scope;

      return matchesQuery && matchesStatus && matchesScope;
    });
  }, [announcements.data, query, scope, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, scope, status]);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Surface>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#f7f7ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
            <Megaphone className="h-3.5 w-3.5" />
            Comunicacion interna
          </span>
          <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal sm:text-[28px]">
            Noticias, avisos y campanas para cada audiencia.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
            Publica comunicados para todo Grupo SP, empresas especificas o equipos. Luego esto alimentara el portal y la app movil.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Megaphone} label="Comunicados" value={announcements.summary.total.toString()} />
            <MetricCard icon={Send} label="Publicados" tone="success" value={announcements.summary.published.toString()} />
            <MetricCard icon={Clock3} label="Programados" tone="warning" value={announcements.summary.scheduled.toString()} />
            <MetricCard icon={Pin} label="Fijados" value={announcements.summary.pinned.toString()} />
          </div>
        </Surface>

        <aside className="rounded-[18px] border border-[#e1e5eb] bg-white p-4 text-[#1f242d] shadow-sm">
          <p className="text-sm font-semibold">Alcance inteligente</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            RRHH puede enviar mensajes segmentados sin escribir listas manuales ni depender de correos sueltos.
          </p>
          <div className="mt-5 space-y-3">
            <DarkMetric label="Empresas disponibles" value={companies.length} />
            <DarkMetric label="Equipos disponibles" value={organization.teams.length} />
            <DarkMetric label="Segmentados" value={announcements.summary.segmented} />
          </div>
        </aside>
      </section>

      <CrudSection
        actions={
          canManage ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)] transition hover:-translate-y-0.5 hover:bg-[#4338ca]"
              onClick={() => setCreating(true)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Nuevo comunicado
            </button>
          ) : null
        }
        className="mt-3"
        eyebrow="Bandeja"
        filters={
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                <input autoComplete="off"
                  className={`${inputClassName} pl-9`}
                  maxLength={80}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar titulo, mensaje o audiencia"
                  value={query}
                />
              </label>
              <select className={inputClassName} onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="">Todos los estados</option>
                <option value="PUBLISHED">Publicados</option>
                <option value="SCHEDULED">Programados</option>
                <option value="DRAFT">Borradores</option>
                <option value="ARCHIVED">Archivados</option>
              </select>
              <select className={inputClassName} onChange={(event) => setScope(event.target.value)} value={scope}>
                <option value="">Todos los alcances</option>
                <option value="ALL">Todo el grupo</option>
                <option value="COMPANIES">Por empresas</option>
                <option value="TEAMS">Por equipos</option>
                <option value="EMPLOYEES">Por trabajadores</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e1e5eb] bg-white px-3 py-2">
              <span className="text-xs font-bold text-[#667085]">
                {filtered.length} de {announcements.data.length} comunicados
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Grupo", value: "ALL" },
                  { label: "Empresas", value: "COMPANIES" },
                  { label: "Equipos", value: "TEAMS" },
                  { label: "Trabajadores", value: "EMPLOYEES" },
                ].map((option) => (
                  <button
                    className={`h-8 rounded-xl px-3 text-xs font-bold transition ${
                      scope === option.value ? "bg-[#4f46e5] text-white" : "bg-[#f8fafc] text-[#667085] hover:text-[#4f46e5]"
                    }`}
                    key={option.value}
                    onClick={() => setScope(scope === option.value ? "" : option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
        title="Comunicados internos"
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.length > 0 ? visible.map((announcement) => (
            <article
              className="rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-[#b9c5d6] hover:bg-white hover:shadow-[0_16px_34px_rgba(16,24,40,0.06)]"
              key={announcement.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="whitespace-normal break-words text-base font-semibold leading-5">{announcement.title}</h3>
                    <StatusBadge status={announcement.status} />
                    <PriorityBadge priority={announcement.priority} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#667085]">{announcement.message}</p>
                </div>
                {announcement.isPinned ? (
                  <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#4f46e5]">Fijado</span>
                ) : null}
              </div>

              <div className="mt-3 rounded-[16px] border border-[#e1e5eb] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Audiencia</p>
                <p className="mt-2 whitespace-normal break-words text-sm font-semibold leading-5">{audienceLabel(announcement)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {audienceTags(announcement).map((tag) => (
                    <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-semibold text-[#475467]" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-[16px] border border-[#e1e5eb] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Lectura</p>
                    <p className="mt-1 text-sm font-semibold">
                      {announcement.metrics.readCount} leidos de {announcement.metrics.estimatedRecipients}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-bold text-[#4f46e5]">
                    {announcement.metrics.readRate}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2f7]">
                  <div
                    className="h-full rounded-full bg-[#4f46e5] transition-all"
                    style={{ width: `${Math.min(100, announcement.metrics.readRate)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-[#667085]">
                  Faltan {announcement.metrics.pendingCount} trabajadores por confirmar lectura.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="whitespace-normal break-words text-xs leading-4 text-[#667085]">{dateLabel(announcement)}</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                    href={`/comunicados/${announcement.id}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver detalle
                  </Link>
                  {canManage ? (
                    <button
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                      onClick={() => setEditing(announcement)}
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          )) : (
            <div className="xl:col-span-2">
              <EmptyState
                description="Cambia busqueda, estado o audiencia para ampliar los resultados."
                icon={Megaphone}
                title="No hay comunicados con esos filtros"
              />
            </div>
          )}
          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-5 text-sm text-[#667085] xl:col-span-2">
              No hay comunicados con esos filtros.
            </p>
          ) : null}
        </div>

        {filtered.length > pageSize ? (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-[#667085]">Pagina {currentPage} de {totalPages}</p>
            <div className="flex gap-2">
              <button className={pageButtonClass} disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
                Anterior
              </button>
              <button className={pageButtonClass} disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </CrudSection>

      {creating ? <AnnouncementModal companies={companies} onClose={() => setCreating(false)} organization={organization} /> : null}
      {editing ? (
        <AnnouncementModal
          announcement={editing}
          companies={companies}
          onClose={() => setEditing(null)}
          organization={organization}
        />
      ) : null}
    </div>
  );
}

function AnnouncementModal({
  announcement,
  companies,
  onClose,
  organization,
}: {
  announcement?: Announcement;
  companies: Company[];
  onClose: () => void;
  organization: OrganizationData;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [uploadState, setUploadState] = useState<FormState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audienceScope, setAudienceScope] = useState<AnnouncementAudienceScope>(announcement?.audienceScope ?? "ALL");
  const [previewTitle, setPreviewTitle] = useState(announcement?.title ?? "");
  const [previewMessage, setPreviewMessage] = useState(announcement?.message ?? "");
  const [previewImageUrl, setPreviewImageUrl] = useState(announcement?.imageUrl ?? "");
  const [previewStatus, setPreviewStatus] = useState<AnnouncementStatus>(announcement?.status ?? "DRAFT");
  const [previewPriority, setPreviewPriority] = useState<AnnouncementPriority>(announcement?.priority ?? "NORMAL");
  const [previewPinned, setPreviewPinned] = useState(announcement?.isPinned ?? false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(
    () => new Set(announcement?.audiences.flatMap((audience) => (audience.company ? [audience.company.id] : [])) ?? []),
  );
  const [selectedTeamIds, setSelectedTeamIds] = useState(
    () => new Set(announcement?.audiences.flatMap((audience) => (audience.team ? [audience.team.id] : [])) ?? []),
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(
    () => new Set(announcement?.audiences.flatMap((audience) => (audience.employee ? [audience.employee.id] : [])) ?? []),
  );
  const activeEmployees = useMemo(
    () => organization.employees.filter((employee) => employee.status === "ACTIVE"),
    [organization.employees],
  );

  useEffect(() => setIsMounted(true), []);

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadState("error");
      setUploadMessage("Solo JPG, PNG o WebP.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setUploadState("error");
      setUploadMessage("La imagen debe pesar maximo 3 MB.");
      return;
    }

    setUploadState("loading");
    setUploadMessage("");

    try {
      const uploaded = await uploadAnnouncementImage(file);
      setPreviewImageUrl(uploaded.url);
      setUploadState("success");
      setUploadMessage("Imagen subida y lista para usar.");
    } catch (error) {
      setUploadState("error");
      setUploadMessage(error instanceof Error ? error.message : "No se pudo subir la imagen.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload: AnnouncementPayload = {
      title: String(formData.get("title") ?? ""),
      message: String(formData.get("message") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      status: String(formData.get("status") ?? "DRAFT") as AnnouncementStatus,
      priority: String(formData.get("priority") ?? "NORMAL") as AnnouncementPriority,
      audienceScope,
      companyIds: audienceScope === "COMPANIES" ? Array.from(selectedCompanyIds) : [],
      teamIds: audienceScope === "TEAMS" ? Array.from(selectedTeamIds) : [],
      employeeIds: audienceScope === "EMPLOYEES" ? Array.from(selectedEmployeeIds) : [],
      publishAt: String(formData.get("publishAt") ?? ""),
      expiresAt: String(formData.get("expiresAt") ?? ""),
      sendEmail: formData.get("sendEmail") === "on",
      isPinned: formData.get("isPinned") === "on",
    };

    try {
      if (announcement) {
        await updateAnnouncement(announcement.id, payload);
      } else {
        await createAnnouncement(payload);
      }

      setState("success");
      setMessage(announcement ? "Comunicado actualizado." : "Comunicado creado.");
      router.refresh();
      onClose();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el comunicado.");
    }
  }

  if (!isMounted) return null;

  return createPortal(
    <div aria-modal="true" className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm" role="dialog">
      <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">{announcement ? "Editar" : "Nuevo"}</p>
            <h3 className="mt-1 text-xl font-semibold">Comunicado interno</h3>
            <p className="mt-1 text-sm text-[#667085]">Define el mensaje, la audiencia y si se mostrara en portal.</p>
          </div>
          <button aria-label="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60" disabled={state === "loading"} onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form autoComplete="off" className="grid max-h-[calc(100dvh-156px)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSubmit}>
          <div className="px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Titulo">
                <input autoComplete="off" className={inputClassName} defaultValue={announcement?.title ?? ""} maxLength={100} name="title" onChange={(event) => setPreviewTitle(event.target.value)} required />
              </Field>
              <Field label="Estado">
                <select className={inputClassName} name="status" onChange={(event) => setPreviewStatus(event.target.value as AnnouncementStatus)} value={previewStatus}>
                  <option value="DRAFT">Borrador</option>
                  <option value="SCHEDULED">Programado</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </Field>
              <Field label="Prioridad">
                <select className={inputClassName} name="priority" onChange={(event) => setPreviewPriority(event.target.value as AnnouncementPriority)} value={previewPriority}>
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Importante</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </Field>
              <label className="flex h-10 items-center gap-3 self-end rounded-xl border border-[#d8dee8] px-3 text-sm font-semibold text-[#475467]">
                <input autoComplete="off" checked={previewPinned} name="isPinned" onChange={(event) => setPreviewPinned(event.target.checked)} type="checkbox" />
                Fijar arriba
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-[#667085]">Mensaje</span>
                <textarea autoComplete="off" className="min-h-32 w-full rounded-xl border border-[#d8dee8] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]" defaultValue={announcement?.message ?? ""} maxLength={1200} name="message" onChange={(event) => setPreviewMessage(event.target.value)} required />
                <span className="block text-right text-[11px] font-semibold text-[#98a2b3]">{previewMessage.length}/1200</span>
              </label>
              <input autoComplete="off" name="imageUrl" type="hidden" value={previewImageUrl} />
              <div className="sm:col-span-2">
                <input autoComplete="off"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="rounded-2xl border border-[#d8dee8] bg-[#fbfcfd] p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#667085]">Imagen o banner del comunicado</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f242d]">
                        {previewImageUrl ? "Imagen lista para publicar" : "Sube una imagen desde tu computadora"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#667085]">JPG, PNG o WebP. Maximo 3 MB.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {previewImageUrl ? (
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-3 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3]"
                          onClick={() => setPreviewImageUrl("")}
                          type="button"
                        >
                          Quitar
                        </button>
                      ) : null}
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)] transition hover:bg-[#4338ca] disabled:opacity-70"
                        disabled={uploadState === "loading"}
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        {uploadState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        {previewImageUrl ? "Reemplazar imagen" : "Subir imagen"}
                      </button>
                    </div>
                  </div>
                  {previewImageUrl ? (
                    <img
                      alt=""
                      className="mt-3 aspect-[16/5] w-full rounded-xl border border-[#e1e5eb] object-cover"
                      src={mediaUrl(previewImageUrl)}
                    />
                  ) : (
                    <button
                      className="mt-3 flex aspect-[16/5] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#c8d2e0] bg-white text-center transition hover:border-[#4f46e5]"
                      disabled={uploadState === "loading"}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      <UploadCloud className="h-7 w-7 text-[#4f46e5]" />
                      <span className="mt-2 text-sm font-semibold text-[#475467]">Seleccionar banner</span>
                      <span className="mt-1 text-xs text-[#98a2b3]">Recomendado: formato horizontal</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#e1e5eb] p-4">
              <p className="text-sm font-semibold">Audiencia</p>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <ScopeButton active={audienceScope === "ALL"} icon={Megaphone} label="Todo el grupo" onClick={() => setAudienceScope("ALL")} />
                <ScopeButton active={audienceScope === "COMPANIES"} icon={Building2} label="Empresas" onClick={() => setAudienceScope("COMPANIES")} />
                <ScopeButton active={audienceScope === "TEAMS"} icon={UsersRound} label="Equipos" onClick={() => setAudienceScope("TEAMS")} />
                <ScopeButton active={audienceScope === "EMPLOYEES"} icon={UsersRound} label="Trabajadores" onClick={() => setAudienceScope("EMPLOYEES")} />
              </div>
              {audienceScope === "COMPANIES" ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {companies.map((company) => (
                    <CheckOption checked={selectedCompanyIds.has(company.id)} key={company.id} label={company.name} onClick={() => setSelectedCompanyIds((current) => toggleSetValue(current, company.id))} />
                  ))}
                </div>
              ) : null}
              {audienceScope === "TEAMS" ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {organization.teams.map((team) => (
                    <CheckOption checked={selectedTeamIds.has(team.id)} key={team.id} label={`${team.name} · ${team.company.name}`} onClick={() => setSelectedTeamIds((current) => toggleSetValue(current, team.id))} />
                  ))}
                </div>
              ) : null}
              {audienceScope === "EMPLOYEES" ? (
                <div className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1">
                  {activeEmployees.map((employee) => (
                    <CheckOption
                      checked={selectedEmployeeIds.has(employee.id)}
                      key={employee.id}
                      label={`${employee.firstName} ${employee.lastName} · ${employee.company.name}${employee.jobTitle ? ` · ${employee.jobTitle}` : ""}`}
                      onClick={() => setSelectedEmployeeIds((current) => toggleSetValue(current, employee.id))}
                    />
                  ))}
                  {activeEmployees.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] px-3 py-4 text-sm text-[#667085]">
                      No hay trabajadores activos disponibles.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Publicar desde">
                <input autoComplete="off" className={inputClassName} defaultValue={toDateInput(announcement?.publishAt)} name="publishAt" type="date" />
              </Field>
              <Field label="Visible hasta">
                <input autoComplete="off" className={inputClassName} defaultValue={toDateInput(announcement?.expiresAt)} name="expiresAt" type="date" />
              </Field>
              <label className="flex h-10 items-center gap-3 rounded-xl border border-[#d8dee8] px-3 text-sm font-semibold text-[#475467]">
                <input autoComplete="off" defaultChecked={announcement?.sendEmail ?? false} name="sendEmail" type="checkbox" />
                Preparar envio por correo
              </label>
            </div>
          </div>

          <aside className="border-t border-[#e1e5eb] bg-[#fbfcfd] p-5 lg:border-l lg:border-t-0">
            <AnnouncementPreview audienceScope={audienceScope} companyCount={selectedCompanyIds.size} employeeCount={selectedEmployeeIds.size} imageUrl={previewImageUrl} message={previewMessage} pinned={previewPinned} priority={previewPriority} status={previewStatus} teamCount={selectedTeamIds.size} title={previewTitle} />
            <div className="mt-5 border-t border-[#e1e5eb] pt-4">
              <div className="min-h-9">
                {uploadState === "loading" ? <ActionFeedback message="Subiendo imagen..." tone="loading" /> : null}
                {uploadState === "success" ? <ActionFeedback message={uploadMessage} tone="success" /> : null}
                {uploadState === "error" ? <ActionFeedback message={uploadMessage} tone="error" /> : null}
                {state === "loading" ? <ActionFeedback message="Guardando comunicado..." tone="loading" /> : null}
                {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
                {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
              </div>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3] disabled:opacity-60" disabled={state === "loading"} onClick={onClose} type="button">Cancelar</button>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca] disabled:opacity-70" disabled={state === "loading"} type="submit">
                  {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Guardar
                </button>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function AnnouncementPreview({
  audienceScope,
  companyCount,
  employeeCount,
  imageUrl,
  message,
  pinned,
  priority,
  status,
  teamCount,
  title,
}: {
  audienceScope: AnnouncementAudienceScope;
  companyCount: number;
  employeeCount: number;
  imageUrl: string;
  message: string;
  pinned: boolean;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  teamCount: number;
  title: string;
}) {
  const audience =
    audienceScope === "ALL"
      ? "Todo el grupo"
      : audienceScope === "COMPANIES"
        ? `${companyCount} empresas`
        : audienceScope === "TEAMS"
          ? `${teamCount} equipos`
          : `${employeeCount} trabajadores`;

  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Vista previa portal y correo</p>
      <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
            <Megaphone className="h-5 w-5" />
          </span>
          <StatusBadge status={status} />
        </div>
        <h4 className="mt-4 line-clamp-2 text-lg font-semibold">{title.trim() || "Titulo del comunicado"}</h4>
        <p className="mt-3 line-clamp-5 text-sm leading-6 text-[#667085]">{message.trim() || "Mensaje visible para los trabajadores."}</p>
        {isSafePreviewImage(imageUrl) ? (
          <img
            alt=""
            className="mt-4 aspect-[16/7] w-full rounded-xl border border-[#e1e5eb] object-cover"
            src={mediaUrl(imageUrl)}
          />
        ) : null}
        <div className="mt-4 rounded-xl border border-[#e1e5eb] bg-white px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Asunto de correo</p>
          <p className="mt-1 whitespace-normal break-words text-xs font-bold leading-4 text-[#475467]">[Comunicado] {title.trim() || "Titulo del comunicado"}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PriorityBadge priority={priority} />
          {pinned ? <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#4f46e5]">Fijado</span> : null}
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#475467]">{audience}</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <Icon className="h-4 w-4 text-[#4f46e5]" />
      <p className="mt-3 text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-5">{value}</p>
    </article>
  );
}

function DarkMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-3">
      <span className="text-sm text-[#667085]">{label}</span>
      <span className="text-lg font-bold text-[#38bdf8]">{value}</span>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

function ScopeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button className={`flex h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${active ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]" : "border-[#d8dee8] bg-white text-[#475467] hover:border-[#98a2b3]"}`} onClick={onClick} type="button">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CheckOption({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`flex h-11 items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition ${checked ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]" : "border-[#d8dee8] bg-white text-[#475467]"}`} onClick={onClick} type="button">
      <span className="min-w-0 whitespace-normal break-words">{label}</span>
      {checked ? <Check className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}

function StatusBadge({ status }: { status: AnnouncementStatus }) {
  const tones = {
    ARCHIVED: "bg-[#f2f4f7] text-[#667085]",
    DRAFT: "bg-[#f2f4f7] text-[#667085]",
    PUBLISHED: "bg-[#e0f2fe] text-[#0284c7]",
    SCHEDULED: "bg-[#eef2ff] text-[#4f46e5]",
  };
  const labels = { ARCHIVED: "Archivado", DRAFT: "Borrador", PUBLISHED: "Publicado", SCHEDULED: "Programado" };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[status]}`}>{labels[status]}</span>;
}

function PriorityBadge({ priority }: { priority: AnnouncementPriority }) {
  const tones = {
    IMPORTANT: "bg-[#fff7df] text-[#b86b00]",
    NORMAL: "bg-[#f2f4f7] text-[#667085]",
    URGENT: "bg-[#fee4e2] text-[#b42318]",
  };
  const labels = { IMPORTANT: "Importante", NORMAL: "Normal", URGENT: "Urgente" };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[priority]}`}>{labels[priority]}</span>;
}

function audienceLabel(announcement: Announcement) {
  if (announcement.audienceScope === "ALL") return "Visible para todo el grupo";
  if (announcement.audienceScope === "COMPANIES") return "Visible solo para empresas seleccionadas";
  if (announcement.audienceScope === "TEAMS") return "Visible solo para equipos seleccionados";
  return "Visible solo para trabajadores seleccionados";
}

function audienceTags(announcement: Announcement) {
  if (announcement.audienceScope === "ALL") return ["Grupo SP", "Mood", "Infinity", "Supernova"];

  const tags = announcement.audiences.flatMap((audience) => {
    if (audience.company) return [audience.company.name];
    if (audience.team) return [`${audience.team.name} · ${audience.team.company.name}`];
    if (audience.employee) return [`${audience.employee.firstName} ${audience.employee.lastName} · ${audience.employee.company.name}`];
    return [];
  });

  return tags.length > 0 ? tags : ["Sin audiencia definida"];
}

function dateLabel(announcement: Announcement) {
  if (!announcement.publishAt && !announcement.expiresAt) return "Sin rango de publicacion";

  return `${announcement.publishAt ? formatDate(announcement.publishAt) : "Sin inicio"} - ${
    announcement.expiresAt ? formatDate(announcement.expiresAt) : "Sin fin"
  }`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isSafePreviewImage(value: string) {
  const normalized = value.trim();
  return normalized.startsWith("https://") || normalized.startsWith("/uploads/");
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";

const pageButtonClass =
  "h-9 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-50";
