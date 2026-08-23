"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { CrudSection } from "@/components/ui/crud-section";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, Surface } from "@/components/ui/surface";
import { canManageBenefits } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import type { OrganizationData } from "@/features/organization/types";
import {
  Building2,
  Check,
  Gift,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Ticket,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createBenefit, updateBenefit } from "./api";
import type {
  Benefit,
  BenefitAudienceScope,
  BenefitPayload,
  BenefitsResult,
  BenefitStatus,
} from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function BenefitsWorkspace({
  benefits,
  companies,
  currentUser,
  organization,
}: {
  benefits: BenefitsResult;
  companies: Company[];
  currentUser: AuthUser | null;
  organization: OrganizationData;
}) {
  const [editing, setEditing] = useState<Benefit | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("");
  const [page, setPage] = useState(1);
  const canManage = canManageBenefits(currentUser);
  const pageSize = 6;

  const filteredBenefits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return benefits.data.filter((benefit) => {
      const matchesQuery =
        !normalizedQuery ||
        [benefit.title, benefit.category, benefit.description]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = !status || benefit.status === status;
      const matchesScope = !scope || benefit.audienceScope === scope;

      return matchesQuery && matchesStatus && matchesScope;
    });
  }, [benefits.data, query, scope, status]);
  const totalPages = Math.max(1, Math.ceil(filteredBenefits.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleBenefits = filteredBenefits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, scope, status]);

  return (
    <div className="w-full px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Surface>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#f7f7ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
            <Gift className="h-3.5 w-3.5" />
            Intranet para trabajadores
          </span>
          <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal sm:text-[28px]">
            Beneficios, sorteos y comunicados con segmentacion inteligente.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
            Publica beneficios para todo el grupo, empresas especificas o equipos. Esta base luego alimentara la app movil del trabajador.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Gift} label="Beneficios" value={benefits.summary.total.toString()} />
            <MetricCard icon={Sparkles} label="Activos" tone="success" value={benefits.summary.active.toString()} />
            <MetricCard icon={Ticket} label="Destacados" tone="warning" value={benefits.summary.highlighted.toString()} />
            <MetricCard icon={UsersRound} label="Segmentados" value={benefits.summary.segmented.toString()} />
          </div>
        </Surface>

        <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-4 text-[#1f242d] shadow-sm">
          <p className="text-sm font-semibold">Proximo salto</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Desde aqui podremos sumar noticias internas, campañas por fechas, sorteos con participantes y correos automaticos.
          </p>
          <div className="mt-5 space-y-3">
            <DarkMetric label="Empresas conectadas" value={companies.length} />
            <DarkMetric label="Equipos disponibles" value={organization.teams.length} />
            <DarkMetric label="Audiencias listas" value={companies.length + organization.teams.length} />
          </div>
        </div>
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
              Nuevo beneficio
            </button>
          ) : null
        }
        className="mt-3"
        eyebrow="Catalogo"
        filters={
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                <input autoComplete="off"
                  className={`${inputClassName} pl-9`}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre, categoria o detalle"
                  value={query}
                />
              </label>
              <select className={inputClassName} onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Activos</option>
                <option value="DRAFT">Borradores</option>
                <option value="PAUSED">Pausados</option>
                <option value="EXPIRED">Vencidos</option>
              </select>
              <select className={inputClassName} onChange={(event) => setScope(event.target.value)} value={scope}>
                <option value="">Todos los alcances</option>
                <option value="ALL">Todo el grupo</option>
                <option value="COMPANIES">Por empresas</option>
                <option value="TEAMS">Por equipos</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e1e5eb] bg-white px-3 py-2">
              <span className="text-xs font-bold text-[#667085]">
                {filteredBenefits.length} de {benefits.data.length} publicaciones
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Grupo", value: "ALL" },
                  { label: "Empresas", value: "COMPANIES" },
                  { label: "Equipos", value: "TEAMS" },
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
        title="Beneficios publicados"
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleBenefits.length > 0 ? (
            visibleBenefits.map((benefit) => (
              <article
                className="rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-[#b9c5d6] hover:bg-white hover:shadow-[0_16px_34px_rgba(16,24,40,0.06)]"
                key={benefit.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                        {benefit.isHighlighted ? <Sparkles className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <h3 className="whitespace-normal break-words text-base font-semibold leading-5">{benefit.title}</h3>
                        <p className="whitespace-normal break-words text-xs font-semibold leading-4 text-[#667085]">{benefit.category}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <StatusBadge status={benefit.status} />
                    {benefit.isHighlighted ? <Pill label="Destacado" tone="blue" /> : null}
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#667085]">{benefit.description}</p>

                <div className="mt-3 rounded-[16px] border border-[#e1e5eb] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                    Audiencia
                  </p>
                  <p className="mt-2 whitespace-normal break-words text-sm font-semibold leading-5">{audienceLabel(benefit)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {audienceTags(benefit).map((tag) => (
                      <span
                        className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-semibold text-[#475467]"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="whitespace-normal break-words text-xs leading-4 text-[#667085]">{dateLabel(benefit)}</p>
                  {canManage ? (
                    <button
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                      onClick={() => setEditing(benefit)}
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="xl:col-span-2">
              <EmptyState
                description="Cambia busqueda, estado o alcance para ampliar los resultados."
                icon={Gift}
                title="No hay beneficios con esos filtros"
              />
            </div>
          )}
        </div>

        {filteredBenefits.length > pageSize ? (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-[#667085]">
              Pagina {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="h-9 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                Anterior
              </button>
              <button
                className="h-9 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                type="button"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </CrudSection>

      {creating ? (
        <BenefitModal
          companies={companies}
          onClose={() => setCreating(false)}
          organization={organization}
        />
      ) : null}
      {editing ? (
        <BenefitModal
          benefit={editing}
          companies={companies}
          onClose={() => setEditing(null)}
          organization={organization}
        />
      ) : null}
    </div>
  );
}

function BenefitModal({
  benefit,
  companies,
  onClose,
  organization,
}: {
  benefit?: Benefit;
  companies: Company[];
  onClose: () => void;
  organization: OrganizationData;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [audienceScope, setAudienceScope] = useState<BenefitAudienceScope>(benefit?.audienceScope ?? "ALL");
  const [previewTitle, setPreviewTitle] = useState(benefit?.title ?? "");
  const [previewCategory, setPreviewCategory] = useState(benefit?.category ?? "");
  const [previewDescription, setPreviewDescription] = useState(benefit?.description ?? "");
  const [previewStatus, setPreviewStatus] = useState<BenefitStatus>(benefit?.status ?? "DRAFT");
  const [previewHighlighted, setPreviewHighlighted] = useState(benefit?.isHighlighted ?? false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(
    () => new Set(benefit?.audiences.flatMap((audience) => (audience.company ? [audience.company.id] : [])) ?? []),
  );
  const [selectedTeamIds, setSelectedTeamIds] = useState(
    () => new Set(benefit?.audiences.flatMap((audience) => (audience.team ? [audience.team.id] : [])) ?? []),
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds((current) => toggleSetValue(current, companyId));
  }

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((current) => toggleSetValue(current, teamId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload: BenefitPayload = {
      title: String(formData.get("title") ?? ""),
      category: String(formData.get("category") ?? ""),
      description: String(formData.get("description") ?? ""),
      status: String(formData.get("status") ?? "DRAFT") as BenefitStatus,
      audienceScope,
      companyIds: audienceScope === "COMPANIES" ? Array.from(selectedCompanyIds) : [],
      teamIds: audienceScope === "TEAMS" ? Array.from(selectedTeamIds) : [],
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: String(formData.get("endsAt") ?? ""),
      actionLabel: String(formData.get("actionLabel") ?? ""),
      actionUrl: String(formData.get("actionUrl") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      isHighlighted: formData.get("isHighlighted") === "on",
    };

    try {
      if (benefit) {
        await updateBenefit(benefit.id, payload);
      } else {
        await createBenefit(payload);
      }

      setState("success");
      setMessage(benefit ? "Beneficio actualizado." : "Beneficio creado.");
      router.refresh();
      onClose();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el beneficio.");
    }
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="animate-rise flex max-h-[calc(100dvh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
              {benefit ? "Editar" : "Nuevo"}
            </p>
            <h3 className="mt-1 text-xl font-semibold">Beneficio interno</h3>
            <p className="mt-1 text-sm text-[#667085]">
              Define que se publica y exactamente quienes podran verlo.
            </p>
          </div>
          <button
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
            disabled={state === "loading"}
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form autoComplete="off" className="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSubmit}>
          <div className="px-5 py-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Titulo">
              <input autoComplete="off"
                className={inputClassName}
                defaultValue={benefit?.title ?? ""}
                maxLength={90}
                name="title"
                onChange={(event) => setPreviewTitle(event.target.value)}
                required
              />
            </Field>
            <Field label="Categoria">
              <input autoComplete="off"
                className={inputClassName}
                defaultValue={benefit?.category ?? ""}
                maxLength={60}
                name="category"
                onChange={(event) => setPreviewCategory(event.target.value)}
                placeholder="Convenio, sorteo, salud, cultura"
                required
              />
            </Field>
            <Field label="Estado">
              <select
                className={inputClassName}
                name="status"
                onChange={(event) => setPreviewStatus(event.target.value as BenefitStatus)}
                value={previewStatus}
              >
                <option value="DRAFT">Borrador</option>
                <option value="ACTIVE">Activo</option>
                <option value="PAUSED">Pausado</option>
                <option value="EXPIRED">Vencido</option>
              </select>
            </Field>
            <label className="flex h-10 items-center gap-3 self-end rounded-xl border border-[#d8dee8] px-3 text-sm font-semibold text-[#475467]">
              <input autoComplete="off"
                checked={previewHighlighted}
                name="isHighlighted"
                onChange={(event) => setPreviewHighlighted(event.target.checked)}
                type="checkbox"
              />
              Destacar en portada del trabajador
            </label>
            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-semibold text-[#667085]">Descripcion</span>
              <textarea autoComplete="off"
                className="min-h-24 w-full rounded-xl border border-[#d8dee8] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                defaultValue={benefit?.description ?? ""}
                maxLength={520}
                name="description"
                onChange={(event) => setPreviewDescription(event.target.value)}
                required
              />
              <span className="block text-right text-[11px] font-semibold text-[#98a2b3]">
                {previewDescription.length}/520
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-[#e1e5eb] p-4">
            <p className="text-sm font-semibold">Audiencia</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <ScopeButton
                active={audienceScope === "ALL"}
                icon={Megaphone}
                label="Todo el grupo"
                onClick={() => setAudienceScope("ALL")}
              />
              <ScopeButton
                active={audienceScope === "COMPANIES"}
                icon={Building2}
                label="Empresas"
                onClick={() => setAudienceScope("COMPANIES")}
              />
              <ScopeButton
                active={audienceScope === "TEAMS"}
                icon={UsersRound}
                label="Equipos"
                onClick={() => setAudienceScope("TEAMS")}
              />
            </div>

            {audienceScope === "COMPANIES" ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {companies.map((company) => (
                  <CheckOption
                    checked={selectedCompanyIds.has(company.id)}
                    key={company.id}
                    label={company.name}
                    onClick={() => toggleCompany(company.id)}
                  />
                ))}
              </div>
            ) : null}

            {audienceScope === "TEAMS" ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {organization.teams.map((team) => (
                  <CheckOption
                    checked={selectedTeamIds.has(team.id)}
                    key={team.id}
                    label={`${team.name} · ${team.company.name}`}
                    onClick={() => toggleTeam(team.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Inicio visible">
              <input autoComplete="off" className={inputClassName} defaultValue={toDateInput(benefit?.startsAt)} name="startsAt" type="date" />
            </Field>
            <Field label="Fin visible">
              <input autoComplete="off" className={inputClassName} defaultValue={toDateInput(benefit?.endsAt)} name="endsAt" type="date" />
            </Field>
            <Field label="Texto del boton">
              <input autoComplete="off" className={inputClassName} defaultValue={benefit?.actionLabel ?? ""} name="actionLabel" />
            </Field>
            <Field label="Enlace o correo">
              <input autoComplete="off" className={inputClassName} defaultValue={benefit?.actionUrl ?? ""} name="actionUrl" />
            </Field>
            <Field label="Imagen futura">
              <input autoComplete="off" className={inputClassName} defaultValue={benefit?.imageUrl ?? ""} name="imageUrl" />
            </Field>
          </div>
          </div>

          <aside className="border-t border-[#e1e5eb] bg-[#fbfcfd] p-5 lg:border-l lg:border-t-0">
            <BenefitPreview
              audienceScope={audienceScope}
              category={previewCategory}
              companyCount={selectedCompanyIds.size}
              description={previewDescription}
              highlighted={previewHighlighted}
              status={previewStatus}
              teamCount={selectedTeamIds.size}
              title={previewTitle}
            />

          <div className="mt-5 border-t border-[#e1e5eb] pt-4">
            <div className="min-h-9">
              {state === "loading" ? <ActionFeedback message="Guardando beneficio..." tone="loading" /> : null}
              {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
              {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
            </div>
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3] disabled:opacity-60"
                disabled={state === "loading"}
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca] disabled:opacity-70"
                disabled={state === "loading"}
                type="submit"
              >
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

function BenefitPreview({
  audienceScope,
  category,
  companyCount,
  description,
  highlighted,
  status,
  teamCount,
  title,
}: {
  audienceScope: BenefitAudienceScope;
  category: string;
  companyCount: number;
  description: string;
  highlighted: boolean;
  status: BenefitStatus;
  teamCount: number;
  title: string;
}) {
  const audience =
    audienceScope === "ALL"
      ? "Todo el grupo"
      : audienceScope === "COMPANIES"
        ? `${companyCount} empresas`
        : `${teamCount} equipos`;

  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Vista previa</p>
      <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
            {highlighted ? <Sparkles className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
          </span>
          <StatusBadge status={status} />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
          {category.trim() || "Categoria"}
        </p>
        <h4 className="mt-2 line-clamp-2 text-lg font-semibold">
          {title.trim() || "Titulo del beneficio"}
        </h4>
        <p className="mt-3 line-clamp-4 text-sm leading-6 text-[#667085]">
          {description.trim() || "Descripcion visible para los trabajadores."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {highlighted ? <Pill label="Destacado" tone="blue" /> : null}
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#475467]">
            {audience}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <PreviewRow label="Publicacion" value={statusLabel(status)} />
        <PreviewRow label="Audiencia" value={audience} />
        <PreviewRow label="Portada" value={highlighted ? "Aparece destacado" : "Listado normal"} />
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fbfcfd] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-5 text-[#171b23]">{value}</p>
    </div>
  );
}

function ScopeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
        active
          ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]"
          : "border-[#d8dee8] bg-white text-[#475467] hover:border-[#98a2b3]"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CheckOption({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex h-11 items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition ${
        checked ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]" : "border-[#d8dee8] bg-white text-[#475467]"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0 whitespace-normal break-words">{label}</span>
      {checked ? <Check className="h-4 w-4 shrink-0" /> : null}
    </button>
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

function StatusBadge({ status }: { status: BenefitStatus }) {
  const tones = {
    ACTIVE: "bg-[#e0f2fe] text-[#0284c7]",
    DRAFT: "bg-[#f2f4f7] text-[#667085]",
    PAUSED: "bg-[#fff4e5] text-[#b54708]",
    EXPIRED: "bg-[#fee4e2] text-[#b42318]",
  };
  const labels = { ACTIVE: "Activo", DRAFT: "Borrador", PAUSED: "Pausado", EXPIRED: "Vencido" };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[status]}`}>{labels[status]}</span>;
}

function statusLabel(status: BenefitStatus) {
  return { ACTIVE: "Activo", DRAFT: "Borrador", PAUSED: "Pausado", EXPIRED: "Vencido" }[status];
}

function Pill({ label, tone }: { label: string; tone: "blue" }) {
  return (
    <span className={tone === "blue" ? "rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#4f46e5]" : ""}>
      {label}
    </span>
  );
}

function audienceLabel(benefit: Benefit) {
  if (benefit.audienceScope === "ALL") return "Visible para todo el grupo";
  if (benefit.audienceScope === "COMPANIES") return "Visible solo para empresas seleccionadas";
  return "Visible solo para equipos seleccionados";
}

function audienceTags(benefit: Benefit) {
  if (benefit.audienceScope === "ALL") return ["Grupo SP", "Mood", "Infinity", "Supernova"];

  const tags = benefit.audiences.flatMap((audience) => {
    if (audience.company) return [audience.company.name];
    if (audience.team) return [`${audience.team.name} · ${audience.team.company.name}`];
    return [];
  });

  return tags.length > 0 ? tags : ["Sin audiencia definida"];
}

function dateLabel(benefit: Benefit) {
  if (!benefit.startsAt && !benefit.endsAt) return "Sin rango de vigencia";

  return `${benefit.startsAt ? formatDate(benefit.startsAt) : "Sin inicio"} - ${
    benefit.endsAt ? formatDate(benefit.endsAt) : "Sin fin"
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

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return next;
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
