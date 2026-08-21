"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrudSection } from "@/components/ui/crud-section";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextField } from "@/components/ui/field";
import { MetricCard, Surface } from "@/components/ui/surface";
import { canManageOrganization } from "@/features/auth/permissions";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  Search,
  Layers3,
  Loader2,
  Network,
  Pencil,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createArea,
  createAssignment,
  createClient,
  createJobPosition,
  createWorkTeam,
  OrganizationApiError,
  updateArea,
  updateAssignment,
  updateClient,
  updateJobPosition,
  updateWorkTeam,
  updateWorkTeamMembers,
} from "./api";
import type {
  Area,
  AssignmentPayload,
  Client,
  EmployeeClientAssignment,
  JobPositionScope,
  JobPosition,
  OrganizationData,
  OrganizationPayload,
  OrganizationStatus,
  StructuralImpact,
  WorkTeam,
} from "./types";

type ModalKind = "area" | "position" | "team";
type FormState = "idle" | "loading" | "success" | "error";
type EditingEntity = Area | JobPosition | WorkTeam | null;
type OrganizationTab = "areas" | "positions" | "teams" | "clients";

export function OrganizationWorkspace({
  companies,
  companyId,
  currentUser,
  organization,
}: {
  companies: Company[];
  companyId?: string;
  currentUser: AuthUser | null;
  organization: OrganizationData;
}) {
  const router = useRouter();
  const canManage = canManageOrganization(currentUser);
  const activeCompany = companies.find((company) => company.id === companyId) ?? null;
  const [activeTab, setActiveTab] = useState<OrganizationTab>("areas");

  function handleCompanyChange(value: string) {
    const suffix = value ? `?empresa=${value}` : "";
    router.push(`/organizacion${suffix}`);
  }

  return (
          <div className="mx-auto max-w-7xl px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <Surface>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#f7f7ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
                    <Network className="h-3.5 w-3.5" />
                    Organigrama operativo
                  </span>
                  <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-[28px]">
                    Ordena personas en areas, cargos y equipos.
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                    Esta pantalla sirve para decirle al sistema donde trabaja cada persona, quien es su responsable y a que grupo pertenece. Luego esto alimenta aprobaciones, beneficios, comunicados y reportes.
                  </p>
                </div>

                <div className="w-full max-w-sm">
                  <SelectField
                    label="Ver empresa"
                    onChange={(event) => handleCompanyChange(event.target.value)}
                    value={companyId ?? ""}
                  >
                    <option value="">Todas las empresas</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Building2} label="Empresa visible" tone="neutral" value={activeCompany ? activeCompany.name : "Todo Grupo SP"} />
                <MetricCard icon={Layers3} label="Areas creadas" value={organization.summary.areas.toString()} />
                <MetricCard icon={BriefcaseBusiness} label="Cargos creados" tone="warning" value={organization.summary.positions.toString()} />
                <MetricCard icon={UsersRound} label="Equipos creados" tone="success" value={organization.summary.teams.toString()} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <GuideStep number="1" title="Areas" text="Agrupa departamentos como Operaciones, Ventas, Marketing o Direccion." />
                <GuideStep number="2" title="Cargos" text="Define puestos dentro de cada area: supervisor, analista, coordinador, asistente." />
                <GuideStep number="3" title="Equipos" text="Une trabajadores con un responsable para aprobaciones y comunicados." />
              </div>
            </Surface>

            <OrganizationTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              organization={organization}
            />

            <section className="mt-3">
              {activeTab === "areas" ? (
                <ResourcePanel
                  canManage={canManage}
                  companies={companies}
                  companyId={companyId}
                  employees={organization.employees}
                  items={organization.areas}
                  kind="area"
                  title="Areas"
                  step="Estructura"
                  helper="Departamentos o unidades de trabajo. Desde aqui nacen cargos, equipos y reportes."
                />
              ) : null}

              {activeTab === "positions" ? (
                <ResourcePanel
                  areas={organization.areas}
                  canManage={canManage}
                  clients={organization.clients}
                  companies={companies}
                  companyId={companyId}
                  employees={organization.employees}
                  items={organization.positions}
                  kind="position"
                  title="Cargos"
                  step="Estructura"
                  helper="Puestos laborales por empresa o para todo el grupo."
                />
              ) : null}

              {activeTab === "teams" ? (
                <div className="space-y-3">
                  <ResourcePanel
                    areas={organization.areas}
                    canManage={canManage}
                    companies={companies}
                    companyId={companyId}
                    employees={organization.employees}
                    items={organization.teams}
                    kind="team"
                    title="Equipos"
                    step="Submodulo"
                    helper="Equipos operativos, responsables, cliente principal e integrantes."
                  />
                  <TeamStructurePanel
                    canManage={canManage}
                    employees={organization.employees}
                    teams={organization.teams}
                  />
                </div>
              ) : null}

              {activeTab === "clients" ? (
                <ClientAssignmentsPanel
                  areas={organization.areas}
                  assignments={organization.assignments}
                  canManage={canManage}
                  clients={organization.clients}
                  companies={companies}
                  companyId={companyId}
                  employees={organization.employees}
                  teams={organization.teams}
                />
              ) : null}
            </section>
          </div>
  );
}

function OrganizationTabs({
  activeTab,
  onChange,
  organization,
}: {
  activeTab: OrganizationTab;
  onChange: (tab: OrganizationTab) => void;
  organization: OrganizationData;
}) {
  const tabs: Array<{
    count: number;
    icon: React.ElementType;
    id: OrganizationTab;
    label: string;
  }> = [
    { count: organization.summary.areas, icon: Layers3, id: "areas", label: "Areas" },
    { count: organization.summary.positions, icon: BriefcaseBusiness, id: "positions", label: "Cargos" },
    { count: organization.summary.teams, icon: UsersRound, id: "teams", label: "Equipos" },
    { count: organization.summary.clients, icon: Building2, id: "clients", label: "Clientes" },
  ];

  return (
    <div className="mt-3 overflow-x-auto rounded-[18px] border border-[#dfe5ee] bg-white p-1.5 shadow-sm">
      <div className="flex min-w-max gap-1.5 sm:min-w-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;

          return (
            <button
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[14px] px-3 text-sm font-bold transition ${
                active
                  ? "bg-[#4f46e5] text-white shadow-[0_12px_24px_rgba(79,70,229,0.2)]"
                  : "text-[#475467] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
              }`}
              key={tab.id}
              onClick={() => onChange(tab.id)}
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-[#f1f5f9] text-[#667085]"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamStructurePanel({
  canManage,
  employees,
  teams,
}: {
  canManage: boolean;
  employees: OrganizationData["employees"];
  teams: WorkTeam[];
}) {
  const [editingTeam, setEditingTeam] = useState<WorkTeam | null>(null);

  return (
    <CrudSection
      actions={<Badge>{teams.length} equipos</Badge>}
      className="mt-3"
      description="Aqui ves cada equipo con su responsable e integrantes. Si falta algo, usa Gestionar equipo."
      eyebrow="Resultado final"
      title="Equipos armados"
    >
      <div className="grid gap-3 xl:grid-cols-2">
        {teams.length > 0 ? (
          teams.map((team) => (
            <article
              className="rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-[#b9c5d6] hover:bg-white hover:shadow-[0_14px_28px_rgba(15,23,42,0.055)]"
              key={team.id}
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                  <h3 className="whitespace-normal break-words text-base font-semibold leading-5">{team.name}</h3>
                    <StatusBadge status={team.status} />
                  </div>
                  <p className="mt-1 text-sm text-[#667085]">
                    {resourceCompanyName(team)} · {team.client?.name ?? "Sin cliente"} · {team.area?.name ?? "Sin area"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#edf0f5] bg-white px-3 py-2 text-xs font-bold text-[#475467]">
                  <UsersRound className="h-4 w-4 text-[#4f46e5]" />
                  {team.employees.length} miembros
                </span>
              </div>

              <div className="mt-3 rounded-[16px] border border-[#e1e5eb] bg-white p-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                  <ShieldCheck className="h-4 w-4 text-[#0284c7]" />
                  Responsable
                </p>
                {team.leader ? (
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar firstName={team.leader.firstName} lastName={team.leader.lastName} />
                    <div className="min-w-0">
                      <p className="whitespace-normal break-words text-sm font-semibold leading-5">
                        {team.leader.firstName} {team.leader.lastName}
                      </p>
                      <p className="mt-0.5 whitespace-normal break-words text-xs leading-5 text-[#667085]">
                        {team.leader.jobTitle ?? "Sin cargo"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-[#d8dee8] bg-[#fbfcfd] p-3 text-sm text-[#667085]">
                    Aun falta asignar responsable.
                  </p>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                  Integrantes
                </p>
                {team.employees.length > 0 ? (
                  team.employees.slice(0, 6).map((employee) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-[16px] border border-[#e1e5eb] bg-white p-2.5"
                      key={employee.id}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar firstName={employee.firstName} lastName={employee.lastName} />
                        <div className="min-w-0">
                          <p className="whitespace-normal break-words text-sm font-semibold leading-5">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="mt-0.5 whitespace-normal break-words text-xs leading-5 text-[#667085]">
                            {employee.position?.name ?? employee.jobTitle ?? "Sin cargo"}
                          </p>
                        </div>
                      </div>
                      <EmployeeStatusBadge status={employee.status} />
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-[#d8dee8] bg-white p-3 text-sm text-[#667085]">
                    No hay trabajadores asignados a este equipo.
                  </p>
                )}

                {team.employees.length > 6 ? (
                  <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#667085]">
                    +{team.employees.length - 6} integrantes mas
                  </p>
                ) : null}
              </div>

              {canManage ? (
                <div className="mt-4 border-t border-[#e1e5eb] pt-3">
                  <Button
                    className="w-full"
                    icon={Pencil}
                    onClick={() => setEditingTeam(team)}
                    type="button"
                  >
                    Gestionar equipo
                  </Button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="xl:col-span-2">
            <EmptyState
              description="Crea equipos para visualizar responsables, integrantes y reglas de aprobacion."
              icon={UsersRound}
              title="Todavia no hay equipos armados"
            />
          </div>
        )}
      </div>

      {editingTeam ? (
        <TeamMembersModal
          employees={employees.filter((employee) => employee.company.id === editingTeam.company.id)}
          onClose={() => setEditingTeam(null)}
          team={editingTeam}
        />
      ) : null}
    </CrudSection>
  );
}

function TeamMembersModal({
  employees,
  onClose,
  team,
}: {
  employees: OrganizationData["employees"];
  onClose: () => void;
  team: WorkTeam;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "selected" | "unassigned">("all");
  const [leaderEmployeeId, setLeaderEmployeeId] = useState(team.leader?.id ?? "");
  const [selectedIds, setSelectedIds] = useState(() => new Set(team.employees.map((employee) => employee.id)));
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => selectedIds.has(employee.id)),
    [employees, selectedIds],
  );
  const leaderEmployee = selectedEmployees.find((employee) => employee.id === leaderEmployeeId) ?? null;

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return employees.filter((employee) => {
      if (viewMode === "selected" && !selectedIds.has(employee.id)) {
        return false;
      }

      if (viewMode === "unassigned" && employee.teamId && employee.teamId !== team.id) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const content = [
        employee.firstName,
        employee.lastName,
        employee.jobTitle,
        employee.position?.name,
        employee.areaRef?.name,
        employee.team?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return content.includes(normalizedQuery);
    });
  }, [employees, query, selectedIds, team.id, viewMode]);

  function toggleEmployee(employeeId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(employeeId)) {
        next.delete(employeeId);
        if (leaderEmployeeId === employeeId) {
          setLeaderEmployeeId("");
        }
      } else {
        next.add(employeeId);
      }

      return next;
    });
  }

  function selectFilteredEmployees() {
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const employee of filteredEmployees) {
        next.add(employee.id);
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setLeaderEmployeeId("");
  }

  function handleLeaderChange(value: string) {
    setLeaderEmployeeId(value);

    if (value) {
      setSelectedIds((current) => new Set(current).add(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    try {
      const employeeIds = Array.from(selectedIds);

      if (employeeIds.length > 0 && !leaderEmployeeId) {
        throw new Error("Selecciona un responsable antes de guardar el equipo.");
      }

      await updateWorkTeamMembers(team.id, {
        employeeIds,
        leaderEmployeeId: leaderEmployeeId || undefined,
      });

      setState("success");
      setMessage("Equipo actualizado correctamente.");
      router.refresh();
      onClose();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el equipo.");
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
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
              Gestion de equipo
            </p>
            <h3 className="mt-1 whitespace-normal break-words text-xl font-semibold leading-6">{team.name}</h3>
            <p className="mt-1 text-sm text-[#667085]">
              Asigna integrantes y responsable para aprobaciones, comunicados, beneficios y sorteos.
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

        <form autoComplete="off" className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_300px]" onSubmit={handleSubmit}>
          <div className="min-h-0 overflow-y-auto px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_260px]">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[#667085]">Buscar trabajador</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                  <input autoComplete="off"
                    className={`${inputClassName} pl-9`}
                    maxLength={80}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nombre, cargo, area o equipo"
                    value={query}
                  />
                </span>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[#667085]">Responsable</span>
                <select
                  className={inputClassName}
                  onChange={(event) => handleLeaderChange(event.target.value)}
                  value={leaderEmployeeId}
                >
                  <option value="">Seleccionar responsable</option>
                  {selectedEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-3 rounded-xl bg-white p-1 text-xs font-bold text-[#667085]">
                <button
                  className={`rounded-lg px-3 py-2 transition ${viewMode === "all" ? "bg-[#eef2ff] text-[#4f46e5]" : "hover:bg-[#f8fafc]"}`}
                  onClick={() => setViewMode("all")}
                  type="button"
                >
                  Todos
                </button>
                <button
                  className={`rounded-lg px-3 py-2 transition ${viewMode === "selected" ? "bg-[#eef2ff] text-[#4f46e5]" : "hover:bg-[#f8fafc]"}`}
                  onClick={() => setViewMode("selected")}
                  type="button"
                >
                  Elegidos
                </button>
                <button
                  className={`rounded-lg px-3 py-2 transition ${viewMode === "unassigned" ? "bg-[#eef2ff] text-[#4f46e5]" : "hover:bg-[#f8fafc]"}`}
                  onClick={() => setViewMode("unassigned")}
                  type="button"
                >
                  Libres
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="h-9 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                  onClick={selectFilteredEmployees}
                  type="button"
                >
                  Seleccionar visibles
                </button>
                <button
                  className="h-9 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#d92d20] hover:text-[#d92d20]"
                  onClick={clearSelection}
                  type="button"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e1e5eb]">
              <div className="flex items-center justify-between gap-3 border-b border-[#e1e5eb] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Trabajadores disponibles</p>
                  <p className="mt-0.5 text-xs text-[#667085]">{filteredEmployees.length} visibles para este filtro</p>
                </div>
                <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
                  {selectedIds.size} seleccionados
                </span>
              </div>

              <div className="max-h-[390px] overflow-y-auto p-2">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => {
                    const checked = selectedIds.has(employee.id);

                    return (
                      <button
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                          checked ? "bg-[#eef2ff]" : "hover:bg-[#f8fafc]"
                        }`}
                        key={employee.id}
                        onClick={() => toggleEmployee(employee.id)}
                        type="button"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar firstName={employee.firstName} lastName={employee.lastName} />
                          <span className="min-w-0">
                            <span className="block whitespace-normal break-words text-sm font-semibold leading-5">
                              {employee.firstName} {employee.lastName}
                            </span>
                            <span className="block whitespace-normal break-words text-xs leading-5 text-[#667085]">
                              {employee.position?.name ?? employee.jobTitle ?? "Sin cargo"} ·{" "}
                              {employee.areaRef?.name ?? "Sin area"}
                            </span>
                            <span className="mt-1 block whitespace-normal break-words text-[11px] font-semibold leading-4 text-[#98a2b3]">
                              {employee.team?.name ? `Actual: ${employee.team.name}` : "Sin equipo actual"}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                            checked
                              ? "border-[#4f46e5] bg-[#4f46e5] text-white"
                              : "border-[#d8dee8] bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-[#d8dee8] p-4 text-sm text-[#667085]">
                    No hay trabajadores con ese filtro.
                  </p>
                )}
              </div>
            </div>
          </div>

          <aside className="border-t border-[#e1e5eb] bg-[#fbfcfd] p-5 lg:border-l lg:border-t-0">
            <div className="rounded-2xl border border-[#e1e5eb] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                Resumen
              </p>
              <div className="mt-4 space-y-3">
                <SummaryRow label="Empresa" value={resourceCompanyName(team)} />
                <SummaryRow label="Cliente" value={team.client?.name ?? "Sin cliente principal"} />
                <SummaryRow label="Area" value={team.area?.name ?? "Sin area"} />
                <SummaryRow label="Integrantes" value={selectedIds.size.toString()} />
                <SummaryRow
                  label="Responsable"
                  value={leaderEmployee ? `${leaderEmployee.firstName} ${leaderEmployee.lastName}` : "Pendiente"}
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Seleccionados</p>
                <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[11px] font-bold text-[#667085]">{selectedEmployees.length}</span>
              </div>
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                {selectedEmployees.slice(0, 8).map((employee) => (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-[#fbfcfd] px-3 py-2" key={employee.id}>
                    <div className="min-w-0">
                      <p className="whitespace-normal break-words text-xs font-semibold leading-4">{employee.firstName} {employee.lastName}</p>
                      <p className="whitespace-normal break-words text-[11px] leading-4 text-[#667085]">{employee.position?.name ?? employee.jobTitle ?? "Sin cargo"}</p>
                    </div>
                    <button
                      aria-label={`Quitar ${employee.firstName} ${employee.lastName}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e1e5eb] text-[#667085] transition hover:border-[#d92d20] hover:text-[#d92d20]"
                      onClick={() => toggleEmployee(employee.id)}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {selectedEmployees.length > 8 ? (
                  <p className="rounded-xl bg-[#f2f4f7] px-3 py-2 text-xs font-semibold text-[#667085]">
                    +{selectedEmployees.length - 8} trabajadores mas
                  </p>
                ) : null}
                {selectedEmployees.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#d8dee8] p-3 text-xs text-[#667085]">
                    Selecciona integrantes para activar el responsable.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 min-h-9">
              {state === "loading" ? <ActionFeedback message="Actualizando equipo..." tone="loading" /> : null}
              {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
              {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca] disabled:opacity-70"
                disabled={state === "loading"}
                type="submit"
              >
                {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Guardar equipo
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3] disabled:opacity-60"
                disabled={state === "loading"}
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function ClientAssignmentsPanel({
  areas,
  assignments,
  canManage,
  clients,
  companies,
  companyId,
  employees,
  teams,
}: {
  areas: Area[];
  assignments: EmployeeClientAssignment[];
  canManage: boolean;
  clients: Client[];
  companies: Company[];
  companyId?: string;
  employees: OrganizationData["employees"];
  teams: WorkTeam[];
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingAssignment, setEditingAssignment] =
    useState<EmployeeClientAssignment | null>(null);
  const defaultCompanyId = companyId ?? companies[0]?.id ?? "";
  const activeClients = clients.filter((client) => client.status === "ACTIVE");
  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE");

  async function handleClientSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState("loading");
    setMessage("");

    try {
      await createClient({
        companyId: String(data.get("companyId") ?? ""),
        name: String(data.get("name") ?? ""),
        slug: String(data.get("slug") ?? ""),
        description: String(data.get("description") ?? "") || null,
      });
      setState("success");
      setMessage("Cliente creado.");
      router.refresh();
      event.currentTarget.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear el cliente.");
    }
  }

  async function handleClientUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingClient) {
      return;
    }

    const data = new FormData(event.currentTarget);
    setState("loading");
    setMessage("");

    try {
      await updateClient(editingClient.id, {
        companyId: String(data.get("companyId") ?? ""),
        name: String(data.get("name") ?? ""),
        slug: String(data.get("slug") ?? ""),
        description: String(data.get("description") ?? "") || null,
        status: String(data.get("status") ?? "ACTIVE") as OrganizationStatus,
      });
      setState("success");
      setMessage("Cliente actualizado.");
      setEditingClient(null);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el cliente.");
    }
  }

  async function toggleClientStatus(client: Client) {
    setState("loading");
    setMessage("");

    try {
      await updateClient(client.id, {
        companyId: client.company.id,
        name: client.name,
        slug: client.slug,
        description: client.description,
        status: client.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      setState("success");
      setMessage(client.status === "ACTIVE" ? "Cliente inactivado." : "Cliente activado.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo cambiar el estado del cliente.");
    }
  }

  async function handleAssignmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: AssignmentPayload = {
      employeeId: String(data.get("employeeId") ?? ""),
      clientId: String(data.get("clientId") ?? ""),
      areaId: String(data.get("areaId") ?? "") || null,
      teamId: String(data.get("teamId") ?? "") || null,
      role: String(data.get("role") ?? "") || null,
      isPrimary: data.get("isPrimary") === "on",
      startsAt: String(data.get("startsAt") ?? "") || null,
    };

    setState("loading");
    setMessage("");

    try {
      await createAssignment(payload);
      setState("success");
      setMessage("Asignacion creada.");
      router.refresh();
      event.currentTarget.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear la asignacion.");
    }
  }

  async function handleAssignmentUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingAssignment) {
      return;
    }

    const data = new FormData(event.currentTarget);
    const payload: AssignmentPayload = {
      employeeId: editingAssignment.employee.id,
      clientId: String(data.get("clientId") ?? ""),
      areaId: String(data.get("areaId") ?? "") || null,
      teamId: String(data.get("teamId") ?? "") || null,
      role: String(data.get("role") ?? "") || null,
      isPrimary: data.get("isPrimary") === "on",
      startsAt: String(data.get("startsAt") ?? "") || null,
      endsAt: String(data.get("endsAt") ?? "") || null,
      status: String(data.get("status") ?? "ACTIVE") as OrganizationStatus,
    };

    setState("loading");
    setMessage("");

    try {
      await updateAssignment(editingAssignment.id, payload);
      setState("success");
      setMessage("Asignacion actualizada.");
      setEditingAssignment(null);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la asignacion.");
    }
  }

  async function toggleAssignmentStatus(assignment: EmployeeClientAssignment) {
    setState("loading");
    setMessage("");

    try {
      await updateAssignment(assignment.id, {
        employeeId: assignment.employee.id,
        clientId: assignment.client.id,
        areaId: assignment.area?.id ?? null,
        teamId: assignment.team?.id ?? null,
        role: assignment.role,
        isPrimary: assignment.isPrimary,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        status: assignment.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      setState("success");
      setMessage(
        assignment.status === "ACTIVE" ? "Asignacion inactivada." : "Asignacion activada.",
      );
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo cambiar el estado de la asignacion.");
    }
  }

  return (
    <CrudSection
      actions={<Badge>{clients.length} clientes · {assignments.length} asignaciones</Badge>}
      className="mt-3"
      description="Une clientes con equipos y registra trabajadores que atienden uno o varios clientes, areas o equipos."
      eyebrow="Clientes"
      title="Clientes y asignaciones operativas"
    >
      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        {canManage ? (
          <div className="space-y-3">
            <form className="rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-4" onSubmit={handleClientSubmit}>
              <p className="text-sm font-semibold">Crear cliente</p>
              <div className="mt-3 grid gap-3">
                <select className={inputClassName} defaultValue={defaultCompanyId} name="companyId" required>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
                <input className={inputClassName} maxLength={80} name="name" placeholder="Nombre del cliente" required />
                <input className={inputClassName} maxLength={80} name="slug" placeholder="Codigo opcional" />
                <input className={inputClassName} maxLength={120} name="description" placeholder="Descripcion opcional" />
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={state === "loading"} type="submit">
                  {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crear cliente
                </button>
              </div>
            </form>

            {editingClient ? (
              <form className="rounded-[18px] border border-[#c7d2fe] bg-white p-4 shadow-sm" onSubmit={handleClientUpdate}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Editar cliente</p>
                    <p className="mt-1 text-xs text-[#667085]">Actualiza datos o estado sin perder historial.</p>
                  </div>
                  <button className="text-[#667085] transition hover:text-[#4f46e5]" onClick={() => setEditingClient(null)} type="button">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  <select className={inputClassName} defaultValue={editingClient.company.id} name="companyId" required>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                  <input className={inputClassName} defaultValue={editingClient.name} maxLength={80} name="name" placeholder="Nombre del cliente" required />
                  <input className={inputClassName} defaultValue={editingClient.slug} maxLength={80} name="slug" placeholder="Codigo opcional" />
                  <input className={inputClassName} defaultValue={editingClient.description ?? ""} maxLength={120} name="description" placeholder="Descripcion opcional" />
                  <select className={inputClassName} defaultValue={editingClient.status} name="status">
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={state === "loading"} type="submit">
                    {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Guardar cliente
                  </button>
                </div>
              </form>
            ) : null}

            <form className="rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-4" onSubmit={handleAssignmentSubmit}>
              <p className="text-sm font-semibold">Asignar trabajador</p>
              <div className="mt-3 grid gap-3">
                <select className={inputClassName} name="employeeId" required>
                  <option value="">Trabajador</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>
                  ))}
                </select>
                <select className={inputClassName} name="clientId" required>
                  <option value="">Cliente</option>
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                <select className={inputClassName} name="areaId">
                  <option value="">Area opcional</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name} · {area.company.name}</option>
                  ))}
                </select>
                <select className={inputClassName} name="teamId">
                  <option value="">Equipo opcional</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name} · {team.company.name}</option>
                  ))}
                </select>
                <input className={inputClassName} maxLength={120} name="role" placeholder="Rol en el cliente" />
                <input className={inputClassName} name="startsAt" type="date" />
                <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-sm font-semibold text-[#475467]">
                  <input name="isPrimary" type="checkbox" />
                  Asignacion principal
                </label>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={state === "loading"} type="submit">
                  {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Guardar asignacion
                </button>
              </div>
            </form>

            {editingAssignment ? (
              <form className="rounded-[18px] border border-[#c7d2fe] bg-white p-4 shadow-sm" onSubmit={handleAssignmentUpdate}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Editar asignacion</p>
                    <p className="mt-1 text-xs text-[#667085]">
                      {editingAssignment.employee.firstName} {editingAssignment.employee.lastName}
                    </p>
                  </div>
                  <button className="text-[#667085] transition hover:text-[#4f46e5]" onClick={() => setEditingAssignment(null)} type="button">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  <select className={inputClassName} defaultValue={editingAssignment.client.id} name="clientId" required>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                  <select className={inputClassName} defaultValue={editingAssignment.area?.id ?? ""} name="areaId">
                    <option value="">Area opcional</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name} · {area.company.name}</option>
                    ))}
                  </select>
                  <select className={inputClassName} defaultValue={editingAssignment.team?.id ?? ""} name="teamId">
                    <option value="">Equipo opcional</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name} · {team.company.name}</option>
                    ))}
                  </select>
                  <input className={inputClassName} defaultValue={editingAssignment.role ?? ""} maxLength={120} name="role" placeholder="Rol en el cliente" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className={inputClassName} defaultValue={dateInputValue(editingAssignment.startsAt)} name="startsAt" type="date" />
                    <input className={inputClassName} defaultValue={dateInputValue(editingAssignment.endsAt)} name="endsAt" type="date" />
                  </div>
                  <select className={inputClassName} defaultValue={editingAssignment.status} name="status">
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-sm font-semibold text-[#475467]">
                    <input defaultChecked={editingAssignment.isPrimary} name="isPrimary" type="checkbox" />
                    Asignacion principal
                  </label>
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={state === "loading"} type="submit">
                    {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Guardar asignacion
                  </button>
                </div>
              </form>
            ) : null}
            {message ? <ActionFeedback message={message} tone={state === "error" ? "error" : state === "loading" ? "loading" : "success"} /> : null}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-4">
            <p className="text-sm font-semibold">Clientes registrados</p>
            <div className="mt-3 space-y-2">
              {clients.map((client) => (
                <div className="rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2" key={client.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="whitespace-normal break-words text-sm font-semibold">{client.name}</p>
                      <StatusBadge status={client.status} />
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button className="rounded-lg px-2 py-1 text-xs font-bold text-[#4f46e5] transition hover:bg-[#eef2ff]" onClick={() => setEditingClient(client)} type="button">
                          Editar
                        </button>
                        <button className="rounded-lg px-2 py-1 text-xs font-bold text-[#667085] transition hover:bg-[#f1f5f9] hover:text-[#111827]" onClick={() => void toggleClientStatus(client)} type="button">
                          {client.status === "ACTIVE" ? "Inactivar" : "Activar"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#667085]">{client.company.name} · {client._count.workTeams} equipos · {client._count.employeeClientAssignments} asignaciones</p>
                </div>
              ))}
              {clients.length === 0 ? <p className="rounded-xl border border-dashed border-[#d8dee8] p-3 text-sm text-[#667085]">Aun no hay clientes.</p> : null}
            </div>
          </div>

          <div className="rounded-[18px] border border-[#e1e5eb] bg-white p-4">
            <p className="text-sm font-semibold">Asignaciones activas</p>
            <div className="mt-3 space-y-2">
              {assignments.slice(0, 12).map((assignment) => (
                <div className="rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2" key={assignment.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="whitespace-normal break-words text-sm font-semibold">{assignment.employee.firstName} {assignment.employee.lastName}</p>
                      <StatusBadge status={assignment.status} />
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button className="rounded-lg px-2 py-1 text-xs font-bold text-[#4f46e5] transition hover:bg-[#eef2ff]" onClick={() => setEditingAssignment(assignment)} type="button">
                          Editar
                        </button>
                        <button className="rounded-lg px-2 py-1 text-xs font-bold text-[#667085] transition hover:bg-[#f1f5f9] hover:text-[#111827]" onClick={() => void toggleAssignmentStatus(assignment)} type="button">
                          {assignment.status === "ACTIVE" ? "Inactivar" : "Activar"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#667085]">
                    {[assignment.client.name, assignment.area?.name, assignment.team?.name, assignment.role, assignment.isPrimary ? "Principal" : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
              {assignments.length === 0 ? <p className="rounded-xl border border-dashed border-[#d8dee8] p-3 text-sm text-[#667085]">Aun no hay asignaciones.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </CrudSection>
  );
}

function ResourcePanel({
  areas = [],
  canManage,
  clients = [],
  companies,
  companyId,
  employees,
  helper,
  items,
  kind,
  step,
  title,
}: {
  areas?: Area[];
  canManage: boolean;
  clients?: Client[];
  companies: Company[];
  companyId?: string;
  employees: OrganizationData["employees"];
  helper: string;
  items: Array<Area | JobPosition | WorkTeam>;
  kind: ModalKind;
  step: string;
  title: string;
}) {
  const [editing, setEditing] = useState<EditingEntity>(null);
  const [detailItem, setDetailItem] = useState<Area | JobPosition | WorkTeam | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrganizationStatus>("ALL");
  const [page, setPage] = useState(1);
  const Icon = kind === "area" ? Layers3 : kind === "position" ? BriefcaseBusiness : UsersRound;
  const pageSize = 20;
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
        const matchesSearch = resourceMatchesSearch(item, query);

        return matchesStatus && matchesSearch;
      }),
    [items, query, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, items.length]);

  return (
    <CrudSection
      actions={
          canManage ? (
            <Button icon={Plus} onClick={() => setIsCreating(true)} size="sm" type="button">
              Nuevo
            </Button>
          ) : null
      }
      className="flex min-h-[420px] flex-col"
      description={helper}
      eyebrow={step}
      filters={
        <div>
          <TextField
            icon={Search}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${title.toLowerCase()}`}
            value={query}
          />

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-xl border border-[#d8dee8] bg-white p-1 text-xs font-bold text-[#667085]">
              {[
                { label: "Todos", value: "ALL" },
                { label: "Activos", value: "ACTIVE" },
                { label: "Inactivos", value: "INACTIVE" },
              ].map((option) => (
                <button
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    statusFilter === option.value ? "bg-[#eef2ff] text-[#4f46e5]" : "hover:bg-[#f8fafc] hover:text-[#344054]"
                  }`}
                  key={option.value}
                  onClick={() => setStatusFilter(option.value as "ALL" | OrganizationStatus)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <span className="rounded-full border border-[#edf0f5] bg-white px-3 py-1.5 text-xs font-bold text-[#667085]">
              {filteredItems.length} de {items.length}
            </span>
          </div>
        </div>
      }
      title={title}
    >
      <div className="flex-1">
        {visibleItems.length > 0 ? (
          <ResourceTable
            canManage={canManage}
            items={visibleItems}
            onEdit={setEditing}
            onViewDetail={setDetailItem}
          />
        ) : (
          <EmptyState
            description={
              items.length === 0
                ? `Aun no hay ${title.toLowerCase()} para este filtro.`
                : "Cambia la busqueda o el estado para volver a ver resultados."
            }
            icon={Icon}
            title={items.length === 0 ? `Sin ${title.toLowerCase()}` : "Sin resultados"}
          />
        )}
      </div>

      {items.length > 0 ? (
        <div className="mt-auto flex flex-col gap-2 rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-[#667085]">
            Pagina {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={currentPage === 1 || totalPages === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              size="sm"
              type="button"
              variant="secondary"
            >
              Anterior
            </Button>
            <Button
              disabled={currentPage === totalPages || totalPages === 1}
              iconAfter={ChevronRight}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              size="sm"
              type="button"
              variant="secondary"
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      {isCreating ? (
          <OrganizationModal
            areas={areas}
            clients={clients}
            companies={companies}
          companyId={companyId}
          employees={employees}
          kind={kind}
          onClose={() => setIsCreating(false)}
        />
      ) : null}
      {detailItem ? (
        <OrganizationDetailModal
          employees={employees}
          item={detailItem}
          kind={kind}
          onClose={() => setDetailItem(null)}
        />
      ) : null}
      {editing ? (
            <OrganizationModal
              areas={areas}
              clients={clients}
              companies={companies}
          companyId={companyId}
          employees={employees}
          entity={editing}
          kind={kind}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </CrudSection>
  );
}

function OrganizationDetailModal({
  employees,
  item,
  kind,
  onClose,
}: {
  employees: OrganizationData["employees"];
  item: Area | JobPosition | WorkTeam;
  kind: ModalKind;
  onClose: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const health = resourceHealth(item);
  const stats = resourceStats(item);
  const relatedEmployees = getRelatedEmployees(item, employees);
  const Icon = kind === "area" ? Layers3 : kind === "position" ? BriefcaseBusiness : UsersRound;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                Detalle de {modalTitle(kind).toLowerCase()}
              </p>
              <h3 className="mt-1 whitespace-normal break-words text-xl font-semibold leading-6">
                {item.name}
              </h3>
              <p className="mt-1 text-sm text-[#667085]">
                {resourceCompanyName(item)} · {item.status === "ACTIVE" ? "Activo" : "Inactivo"}
              </p>
            </div>
          </div>
          <button
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-156px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <DetailStat label="Estado operativo" value={health.label} />
            {stats.map((stat) => (
              <DetailStat key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Lectura rapida
                </p>
                <p className="mt-1 text-sm leading-6 text-[#526173]">{health.text}</p>
              </div>
              <ResourceHealthBadge health={health} />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <DetailRow label="Codigo interno" value={item.slug} />
              <DetailRow label="Creado" value={formatDate(item.createdAt)} />
              {"area" in item ? <DetailRow label="Area relacionada" value={item.area?.name ?? "Sin area"} /> : null}
              {"leader" in item ? (
                <DetailRow
                  label="Responsable"
                  value={item.leader ? `${item.leader.firstName} ${item.leader.lastName}` : "Pendiente"}
                />
              ) : null}
            </div>

            <div className="mt-4 rounded-xl bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">
                Descripcion
              </p>
              <p className="mt-1 whitespace-normal break-words text-sm leading-6 text-[#526173]">
                {item.description?.trim() || "Sin descripcion registrada."}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-white p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Trabajadores relacionados
                </p>
                <h4 className="mt-1 text-base font-semibold">{relatedEmployees.length} personas</h4>
              </div>
              <Badge tone={relatedEmployees.length > 0 ? "success" : "neutral"}>
                {relatedEmployees.length > 0 ? "En uso" : "Sin trabajadores"}
              </Badge>
            </div>

            <div className="mt-3 grid gap-2">
              {relatedEmployees.length > 0 ? (
                relatedEmployees.slice(0, 8).map((employee) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#edf0f5] bg-[#fbfcfd] px-3 py-2"
                    key={employee.id}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar firstName={employee.firstName} lastName={employee.lastName} />
                      <div className="min-w-0">
                        <p className="whitespace-normal break-words text-sm font-semibold leading-5">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-xs text-[#667085]">
                          {employee.position?.name ?? employee.jobTitle ?? "Sin cargo"} · {employee.areaRef?.name ?? employee.area ?? "Sin area"}
                        </p>
                      </div>
                    </div>
                    <EmployeeStatusBadge status={employee.status} />
                  </div>
                ))
              ) : (
                <EmptyState
                  description="Cuando asignes trabajadores, apareceran aqui para validar rapido la estructura."
                  icon={UsersRound}
                  title="Sin personas relacionadas"
                />
              )}
            </div>

            {relatedEmployees.length > 8 ? (
              <p className="mt-3 text-xs font-semibold text-[#667085]">
                + {relatedEmployees.length - 8} trabajadores adicionales.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function OrganizationModal({
  areas,
  clients,
  companies,
  companyId,
  employees,
  entity,
  kind,
  onClose,
}: {
  areas: Area[];
  clients: Client[];
  companies: Company[];
  companyId?: string;
  employees: OrganizationData["employees"];
  entity?: EditingEntity;
  kind: ModalKind;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [impact, setImpact] = useState<StructuralImpact | null>(null);
  const isEditing = Boolean(entity);
  const selectedCompanyId = getEntityCompanyId(entity) ?? companyId ?? companies[0]?.id ?? "";
  const [positionScope, setPositionScope] = useState<JobPositionScope>(getEntityPositionScope(entity));
  const [formCompanyId, setFormCompanyId] = useState(selectedCompanyId);
  const [previewName, setPreviewName] = useState(entity?.name ?? "");
  const [previewDescription, setPreviewDescription] = useState(entity?.description ?? "");
  const [previewAreaId, setPreviewAreaId] = useState(getEntityAreaId(entity));
  const [previewClientId, setPreviewClientId] = useState(getEntityClientId(entity));
  const [previewLeaderId, setPreviewLeaderId] = useState(getEntityLeaderId(entity));
  const [previewStatus, setPreviewStatus] = useState<OrganizationStatus>(entity?.status ?? "ACTIVE");
  const filteredAreas = useMemo(
    () => areas.filter((area) => area.company.id === formCompanyId),
    [areas, formCompanyId],
  );
  const filteredClients = useMemo(
    () => clients.filter((client) => client.company.id === formCompanyId && client.status === "ACTIVE"),
    [clients, formCompanyId],
  );
  const filteredEmployees = useMemo(
    () => employees.filter((employee) => employee.company.id === formCompanyId),
    [employees, formCompanyId],
  );
  const isGroupPosition = kind === "position" && positionScope === "GROUP";
  const previewCompany = isGroupPosition ? null : (companies.find((company) => company.id === formCompanyId) ?? null);
  const previewArea = filteredAreas.find((area) => area.id === previewAreaId) ?? null;
  const previewLeader = filteredEmployees.find((employee) => employee.id === previewLeaderId) ?? null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && state !== "loading") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload: OrganizationPayload = {
      companyId: isGroupPosition ? "" : String(data.get("companyId") ?? ""),
      areaId: String(data.get("areaId") ?? "") || null,
      clientId: String(data.get("clientId") ?? "") || null,
      leaderEmployeeId: String(data.get("leaderEmployeeId") ?? "") || null,
      scope: kind === "position" ? positionScope : undefined,
      name: String(data.get("name") ?? ""),
      slug: String(data.get("slug") ?? ""),
      description: String(data.get("description") ?? "") || null,
      status: String(data.get("status") ?? "ACTIVE") as OrganizationStatus,
    };

    setState("loading");
    setMessage("");
    setImpact(null);

    try {
      if (kind === "area") {
        await (isEditing && entity ? updateArea(entity.id, payload) : createArea(payload));
      }

      if (kind === "position") {
        await (isEditing && entity ? updateJobPosition(entity.id, payload) : createJobPosition(payload));
      }

      if (kind === "team") {
        await (isEditing && entity ? updateWorkTeam(entity.id, payload) : createWorkTeam(payload));
      }

      setState("success");
      setMessage(isEditing ? "Estructura actualizada." : "Estructura creada.");
      router.refresh();
      onClose();
    } catch (error) {
      setState("error");
      if (error instanceof OrganizationApiError && error.impact) {
        setImpact(error.impact);
        setMessage(error.impact.title);
        return;
      }
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
              {isEditing ? "Editar" : "Nuevo"}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{modalTitle(kind)}</h3>
            <p className="mt-1 text-sm text-[#667085]">
              {modalDescription(kind)}
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

        <form autoComplete="off" className="grid max-h-[calc(100dvh-156px)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSubmit}>
          <div className="px-5 py-5">
            <div className="mb-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">{modalStepLabel(kind)}</p>
              <p className="mt-1 text-sm leading-6 text-[#667085]">{modalHelpText(kind)}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {kind === "position" ? (
                <Field label="Alcance del cargo">
                  <select
                    className={inputClassName}
                    name="scope"
                    onChange={(event) => {
                      const nextScope = event.target.value as JobPositionScope;
                      setPositionScope(nextScope);

                      if (nextScope === "GROUP") {
                        setPreviewAreaId("");
                        setPreviewLeaderId("");
                      }
                    }}
                    value={positionScope}
                  >
                    <option value="COMPANY">Solo una empresa</option>
                    <option value="GROUP">Todo el grupo</option>
                  </select>
                </Field>
              ) : null}

              <Field label="Empresa">
                <select
                  className={inputClassName}
                  disabled={isGroupPosition}
                  name="companyId"
                  onChange={(event) => {
                    setFormCompanyId(event.target.value);
                    setPreviewAreaId("");
                    setPreviewClientId("");
                    setPreviewLeaderId("");
                  }}
                  required={!isGroupPosition}
                  value={formCompanyId}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={kind === "area" ? "Nombre del area" : kind === "position" ? "Nombre del cargo" : "Nombre del equipo"}>
                <input autoComplete="off"
                  className={inputClassName}
                  defaultValue={entity?.name ?? ""}
                  maxLength={80}
                  name="name"
                  onChange={(event) => setPreviewName(event.target.value)}
                  placeholder={kind === "team" ? "Ej. Equipo comercial" : "Ej. Operaciones"}
                  required
                />
              </Field>

              <Field label="Codigo interno opcional">
                <input autoComplete="off"
                  className={inputClassName}
                  defaultValue={entity?.slug ?? ""}
                  maxLength={80}
                  name="slug"
                  placeholder="Se genera si lo dejas vacio"
                />
              </Field>

              {kind !== "area" ? (
                <Field label="Area relacionada">
                  <select
                    className={inputClassName}
                    disabled={isGroupPosition}
                    name="areaId"
                    onChange={(event) => setPreviewAreaId(event.target.value)}
                    value={previewAreaId}
                  >
                    <option value="">{isGroupPosition ? "No aplica para todo el grupo" : "Sin area especifica"}</option>
                    {filteredAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {kind === "team" ? (
                <Field label="Cliente principal">
                  <select
                    className={inputClassName}
                    name="clientId"
                    onChange={(event) => setPreviewClientId(event.target.value)}
                    value={previewClientId}
                  >
                    <option value="">Sin cliente principal</option>
                    {filteredClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {kind === "team" ? (
                <Field label="Responsable del equipo">
                  <select
                    className={inputClassName}
                    name="leaderEmployeeId"
                    onChange={(event) => setPreviewLeaderId(event.target.value)}
                    value={previewLeaderId}
                  >
                    <option value="">Pendiente de asignar</option>
                    {filteredEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <Field label="Estado">
                <select
                  className={inputClassName}
                  name="status"
                  onChange={(event) => setPreviewStatus(event.target.value as OrganizationStatus)}
                  value={previewStatus}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </Field>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-[#667085]">Descripcion</span>
                <textarea autoComplete="off"
                  className="min-h-24 w-full rounded-xl border border-[#d8dee8] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                  defaultValue={entity?.description ?? ""}
                  maxLength={420}
                  name="description"
                  onChange={(event) => setPreviewDescription(event.target.value)}
                  placeholder="Notas internas, objetivo del area, cargo o equipo."
                />
                <span className="block text-right text-[11px] font-semibold text-[#98a2b3]">
                  {previewDescription.length}/420
                </span>
              </label>
            </div>
          </div>

          <aside className="border-t border-[#e1e5eb] bg-[#fbfcfd] p-5 lg:border-l lg:border-t-0">
              <OrganizationPreview
                areaName={previewArea?.name ?? null}
              companyName={isGroupPosition ? "Todo el grupo" : (previewCompany?.name ?? "Sin empresa")}
              description={previewDescription}
              kind={kind}
              leaderName={previewLeader ? `${previewLeader.firstName} ${previewLeader.lastName}` : null}
              name={previewName}
              status={previewStatus}
            />

          <div className="mt-5 border-t border-[#e1e5eb] pt-4">
            <div className="min-h-9">
              {state === "loading" ? <ActionFeedback message="Guardando..." tone="loading" /> : null}
              {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
              {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
            </div>
            {impact ? <StructuralImpactNotice impact={impact} /> : null}

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

function GuideStep({ number, text, title }: { number: string; text: string; title: string }) {
  return (
    <article className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#c8d2e0] hover:bg-white">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#4f46e5] text-sm font-bold text-white">
          {number}
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">{text}</p>
        </div>
      </div>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fbfcfd] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-5 text-[#171b23]">{value}</p>
    </div>
  );
}

function StructuralImpactNotice({ impact }: { impact: StructuralImpact }) {
  return (
    <div className="mt-3 rounded-2xl border border-[#fecaca] bg-[#fff7f7] p-3 text-[#7f1d1d]">
      <div className="flex gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#dc2626] shadow-sm">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{impact.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#991b1b]">{impact.message}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {impact.impacts.map((item) => (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-[#fecaca] bg-white px-3 py-2 text-xs"
            key={item.label}
          >
            <span className="font-semibold text-[#7f1d1d]">{item.label}</span>
            <span className="rounded-full bg-[#fee2e2] px-2.5 py-1 font-bold text-[#b91c1c]">
              {item.count}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-white px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#991b1b]">
          Accion recomendada
        </p>
        <p className="mt-1 text-xs leading-5 text-[#7f1d1d]">{impact.recommendation}</p>
      </div>
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

function OrganizationPreview({
  areaName,
  companyName,
  description,
  kind,
  leaderName,
  name,
  status,
}: {
  areaName: string | null;
  companyName: string;
  description: string;
  kind: ModalKind;
  leaderName: string | null;
  name: string;
  status: OrganizationStatus;
}) {
  const Icon = kind === "area" ? Layers3 : kind === "position" ? BriefcaseBusiness : UsersRound;
  const fallbackName = kind === "area" ? "Nueva area" : kind === "position" ? "Nuevo cargo" : "Nuevo equipo";

  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Vista previa</p>
      <div className="mt-4 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-base font-semibold leading-5">{name.trim() || fallbackName}</p>
          <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">{companyName}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <SummaryRow label="Tipo" value={modalTitle(kind)} />
        {kind !== "area" ? <SummaryRow label="Area" value={areaName ?? "Sin area especifica"} /> : null}
        {kind === "team" ? <SummaryRow label="Responsable" value={leaderName ?? "Pendiente"} /> : null}
        <SummaryRow label="Estado" value={status === "ACTIVE" ? "Activo" : "Inactivo"} />
      </div>

      <div className="mt-4 rounded-xl bg-[#fbfcfd] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#667085]">Descripcion</p>
        <p className="mt-1 line-clamp-4 text-xs leading-5 text-[#667085]">
          {description.trim() || "Sin descripcion por ahora."}
        </p>
      </div>
    </div>
  );
}

function ResourceTable({
  canManage,
  items,
  onEdit,
  onViewDetail,
}: {
  canManage: boolean;
  items: Array<Area | JobPosition | WorkTeam>;
  onEdit: (item: Area | JobPosition | WorkTeam) => void;
  onViewDetail: (item: Area | JobPosition | WorkTeam) => void;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-[18px] border border-[#e1e5eb] bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full border-collapse text-left">
            <thead className="bg-[#fbfcfd] text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Indicadores</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f5]">
              {items.map((item) => (
                <ResourceTableRow
                  canManage={canManage}
                  item={item}
                  key={item.id}
                  onEdit={() => onEdit(item)}
                  onViewDetail={() => onViewDetail(item)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2.5 md:hidden">
        {items.map((item) => {
          const health = resourceHealth(item);

          return (
            <article className="rounded-[18px] border border-[#e1e5eb] bg-white p-3 shadow-sm" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-normal break-words text-sm font-semibold leading-5">{item.name}</p>
                  <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">
                    {resourceCompanyName(item)}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-3 grid gap-2">
                {resourceStats(item).slice(0, 2).map((stat) => (
                  <ResourceStat key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </div>
              <p className="mt-3 rounded-xl bg-[#fbfcfd] px-3 py-2 text-xs leading-5 text-[#667085]">
                {item.description?.trim() || health.text}
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[#edf0f5] pt-3">
                <button
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                  onClick={() => onViewDetail(item)}
                  type="button"
                >
                  Ver detalle
                </button>
                {canManage ? (
                  <button
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#4f46e5] px-3 text-xs font-bold text-white transition hover:bg-[#4338ca]"
                    onClick={() => onEdit(item)}
                    type="button"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {health.action}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function ResourceTableRow({
  canManage,
  item,
  onEdit,
  onViewDetail,
}: {
  canManage: boolean;
  item: Area | JobPosition | WorkTeam;
  onEdit: () => void;
  onViewDetail: () => void;
}) {
  const health = resourceHealth(item);
  const stats = resourceStats(item);

  return (
    <tr className="align-top transition hover:bg-[#fbfcfd]">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-sm font-semibold leading-5 text-[#171b23]">{item.name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667085]">
            {item.description?.trim() || health.text}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-[#475467]">
        {resourceCompanyName(item)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-2">
          <StatusBadge status={item.status} />
          <ResourceHealthBadge health={health} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {stats.map((stat) => (
            <span className="rounded-full border border-[#edf0f5] bg-[#fbfcfd] px-2.5 py-1 text-xs font-bold text-[#667085]" key={stat.label}>
              {stat.label}: {stat.value}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
            onClick={onViewDetail}
            type="button"
          >
            Ver
          </button>
          {canManage ? (
            <button
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#4f46e5] px-3 text-xs font-bold text-white transition hover:bg-[#4338ca]"
              onClick={onEdit}
              type="button"
            >
              <Pencil className="h-3.5 w-3.5" />
              {health.action}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ResourceItemCard({
  canManage,
  item,
  onEdit,
  onViewDetail,
}: {
  canManage: boolean;
  item: Area | JobPosition | WorkTeam;
  onEdit: () => void;
  onViewDetail: () => void;
}) {
  const health = resourceHealth(item);

  return (
    <article className="rounded-[16px] border border-[#e1e5eb] bg-[#fbfcfd] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#b9c5d6] hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-5">{item.name}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-1 whitespace-normal break-words text-xs leading-4 text-[#667085]">{resourceCompanyName(item)}</p>
        </div>
        <ResourceHealthBadge health={health} />
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#667085]">
        {item.description?.trim() || health.text}
      </p>

      <div className="mt-3 grid gap-1.5">
        {resourceStats(item).map((stat) => (
          <ResourceStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e1e5eb] pt-2.5">
        <button
          className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-semibold text-[#667085] transition hover:bg-[#eef2ff] hover:text-[#4f46e5]"
          onClick={onViewDetail}
          type="button"
        >
          Ver detalle
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {canManage ? (
          <button
            className="inline-flex h-8 items-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:-translate-y-0.5 hover:border-[#4f46e5] hover:text-[#4f46e5]"
            onClick={onEdit}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
            {health.action}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ResourceHealthBadge({
  health,
}: {
  health: ReturnType<typeof resourceHealth>;
}) {
  const tones = {
    good: "success" as const,
    warning: "warning" as const,
    info: "brand" as const,
  };

  return <Badge tone={tones[health.tone]}>{health.label}</Badge>;
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-bold leading-5 text-[#1f242d]">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#edf0f5] bg-white px-3 py-2">
      <span className="min-w-0 whitespace-normal break-words text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
        {label}
      </span>
      <span className="max-w-[60%] whitespace-normal break-words text-right text-xs font-bold text-[#171b23]">{value}</span>
    </div>
  );
}

function ResourceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#edf0f5] bg-white px-3 py-1.5">
      <span className="min-w-0 whitespace-normal break-words text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
        {label}
      </span>
      <span className="max-w-[58%] whitespace-normal break-words text-right text-xs font-bold text-[#171b23]">{value}</span>
    </div>
  );
}

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-xs font-bold text-[#4f46e5]">
      {firstName || lastName ? `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() : <UserRound className="h-4 w-4" />}
    </span>
  );
}

function StatusBadge({ status }: { status: OrganizationStatus }) {
  return <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>{status === "ACTIVE" ? "Activo" : "Inactivo"}</Badge>;
}

function EmployeeStatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" | "TERMINATED" }) {
  const tones = {
    ACTIVE: "success" as const,
    INACTIVE: "neutral" as const,
    TERMINATED: "danger" as const,
  };
  const labels = {
    ACTIVE: "Activo",
    INACTIVE: "Inactivo",
    TERMINATED: "Cesado",
  };

  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

function resourceMatchesSearch(item: Area | JobPosition | WorkTeam, query: string) {
  const search = normalizeText(query);

  if (!search) {
    return true;
  }

  const health = resourceHealth(item);
  const stats = resourceStats(item);
  const values = [
    item.name,
    item.slug,
    item.description ?? "",
    resourceCompanyName(item),
    item.status === "ACTIVE" ? "activo" : "inactivo",
    health.label,
    health.text,
    ...stats.flatMap((stat) => [stat.label, stat.value]),
  ];

  return normalizeText(values.join(" ")).includes(search);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function getRelatedEmployees(
  item: Area | JobPosition | WorkTeam,
  employees: OrganizationData["employees"],
) {
  if ("leader" in item) {
    return employees.filter((employee) => employee.teamId === item.id || employee.team?.id === item.id);
  }

  if ("area" in item) {
    return employees.filter((employee) => employee.position?.id === item.id);
  }

  return employees.filter((employee) => employee.areaRef?.id === item.id);
}

function resourceHealth(item: Area | JobPosition | WorkTeam): {
  action: string;
  label: string;
  text: string;
  tone: "good" | "info" | "warning";
} {
  if ("leader" in item) {
    if (!item.leader) {
      return {
        action: "Completar",
        label: "Falta responsable",
        text: "Este equipo necesita un responsable para aprobar solicitudes y recibir alertas.",
        tone: "warning",
      };
    }

    if (item.employees.length === 0) {
      return {
        action: "Completar",
        label: "Sin integrantes",
        text: "El responsable ya esta definido, pero aun falta agregar trabajadores al equipo.",
        tone: "warning",
      };
    }

    return {
      action: "Editar",
      label: "Listo",
      text: `Equipo liderado por ${item.leader.firstName} ${item.leader.lastName}.`,
      tone: "good",
    };
  }

  if ("area" in item) {
    if ("scope" in item && item.scope === "GROUP") {
      if (item._count.employees === 0) {
        return {
          action: "Editar",
          label: "Grupo completo",
          text: "Cargo disponible para trabajadores de todas las empresas.",
          tone: "info",
        };
      }

      return {
        action: "Editar",
        label: "Grupo completo",
        text: `Cargo global con ${item._count.employees} trabajadores asignados.`,
        tone: "good",
      };
    }

    if (!item.area) {
      return {
        action: "Completar",
        label: "Sin area",
        text: "Este cargo existe, pero aun no esta conectado a un area.",
        tone: "warning",
      };
    }

    if (item._count.employees === 0) {
      return {
        action: "Editar",
        label: "Sin trabajadores",
        text: `Cargo asociado a ${item.area.name}, todavia sin trabajadores asignados.`,
        tone: "info",
      };
    }

    return {
      action: "Editar",
      label: "Listo",
      text: `Cargo conectado al area ${item.area.name}.`,
      tone: "good",
    };
  }

  if (item._count.jobPositions === 0 && item._count.workTeams === 0 && item._count.employees === 0) {
    return {
      action: "Completar",
      label: "Completar",
      text: "Area creada. Ahora agrega cargos, equipos o trabajadores relacionados.",
      tone: "warning",
    };
  }

  return {
    action: "Editar",
    label: "En uso",
    text: `Area con ${item._count.jobPositions} cargos, ${item._count.workTeams} equipos y ${item._count.employees} trabajadores.`,
    tone: "good",
  };
}

function resourceStats(item: Area | JobPosition | WorkTeam) {
  if ("leader" in item) {
    return [
      { label: "Responsable", value: item.leader ? `${item.leader.firstName} ${item.leader.lastName}` : "Pendiente" },
      { label: "Integrantes", value: item.employees.length.toString() },
    ];
  }

  if ("area" in item) {
    return [
      { label: "Alcance", value: "scope" in item && item.scope === "GROUP" ? "Todo el grupo" : "Empresa" },
      { label: "Area", value: item.area?.name ?? ("scope" in item && item.scope === "GROUP" ? "No aplica" : "Sin area") },
      { label: "Trabajadores", value: item._count.employees.toString() },
    ];
  }

  return [
    { label: "Trabajadores", value: item._count.employees.toString() },
    { label: "Cargos", value: item._count.jobPositions.toString() },
    { label: "Equipos", value: item._count.workTeams.toString() },
  ];
}

function modalTitle(kind: ModalKind) {
  return {
    area: "Area de trabajo",
    position: "Cargo laboral",
    team: "Equipo de trabajo",
  }[kind];
}

function modalDescription(kind: ModalKind) {
  return {
    area: "Crea un departamento o unidad interna donde luego viviran cargos y trabajadores.",
    position: "Crea un puesto laboral y, si corresponde, enlazalo a un area.",
    team: "Crea un grupo operativo y asigna el responsable que lo lidera.",
  }[kind];
}

function modalStepLabel(kind: ModalKind) {
  return {
    area: "Paso 1 de la estructura",
    position: "Paso 2 de la estructura",
    team: "Paso 3 de la estructura",
  }[kind];
}

function modalHelpText(kind: ModalKind) {
  return {
    area: "Piensa en el area como un departamento. Ejemplos: Operaciones, Ventas, Marketing, Administracion.",
    position: "Piensa en el cargo como el puesto que aparece en la ficha del trabajador. Ejemplos: Coordinador, Analista, Supervisor.",
    team: "Piensa en el equipo como el grupo del dia a dia. Debe tener responsable para aprobaciones y comunicados.",
  }[kind];
}

function getEntityCompanyId(entity?: EditingEntity) {
  return entity?.company?.id;
}

function getEntityPositionScope(entity?: EditingEntity): JobPositionScope {
  return entity && "scope" in entity ? entity.scope : "COMPANY";
}

function resourceCompanyName(item: Area | JobPosition | WorkTeam) {
  if ("scope" in item && item.scope === "GROUP") {
    return "Todo el grupo";
  }

  return item.company?.name ?? "Sin empresa";
}

function getEntityAreaId(entity?: EditingEntity) {
  if (entity && "area" in entity) {
    return entity.area?.id ?? "";
  }

  return "";
}

function getEntityClientId(entity?: EditingEntity) {
  if (entity && "client" in entity) {
    return entity.client?.id ?? "";
  }

  return "";
}

function getEntityLeaderId(entity?: EditingEntity) {
  if (entity && "leader" in entity) {
    return entity.leader?.id ?? "";
  }

  return "";
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
