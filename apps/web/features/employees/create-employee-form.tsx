"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { Company } from "@/features/companies/types";
import { IdentityLookupButton } from "@/features/identity-lookup/identity-lookup-button";
import type { IdentityLookupResult } from "@/features/identity-lookup/api";
import type { OrganizationData } from "@/features/organization/types";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  IdCard,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createEmployee, getSuggestedEmployeeCode } from "./api";

type FormState = "idle" | "loading" | "success" | "error";

export function CreateEmployeeForm({
  companies,
  organization,
}: {
  companies: Company[];
  organization: OrganizationData;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [suggestedCode, setSuggestedCode] = useState("");
  const filteredAreas = organization.areas.filter(
    (area) => area.company.id === selectedCompanyId,
  );
  const filteredPositions = organization.positions.filter(
    (position) =>
      position.scope === "GROUP" || position.company?.id === selectedCompanyId,
  );
  const filteredTeams = organization.teams.filter(
    (team) => team.company.id === selectedCompanyId,
  );
  const filteredEmployees = organization.employees.filter(
    (employee) => employee.company.id === selectedCompanyId,
  );
  const documentInputId = "create-employee-document-number";
  const firstNameInputId = "create-employee-first-name";
  const lastNameInputId = "create-employee-last-name";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && state !== "loading") {
        closeModal();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, state]);

  useEffect(() => {
    let ignore = false;

    if (!selectedCompanyId) {
      setSuggestedCode("");
      return;
    }

    setSuggestedCode("Calculando...");

    getSuggestedEmployeeCode(selectedCompanyId)
      .then((result) => {
        if (!ignore) {
          setSuggestedCode(result.code);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSuggestedCode("Se asignara al guardar");
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedCompanyId]);

  function closeModal() {
    if (state === "loading") {
      return;
    }

    setIsOpen(false);
    setSelectedCompanyId("");
    setSuggestedCode("");
    setState("idle");
    setMessage("");
  }

  function applyIdentityLookup(result: IdentityLookupResult) {
    if (result.tipo !== "DNI") {
      return;
    }

    const firstNameInput = document.getElementById(
      firstNameInputId,
    ) as HTMLInputElement | null;
    const lastNameInput = document.getElementById(
      lastNameInputId,
    ) as HTMLInputElement | null;

    if (firstNameInput) {
      firstNameInput.value = result.nombres;
    }

    if (lastNameInput) {
      lastNameInput.value = [result.apellidoPaterno, result.apellidoMaterno]
        .filter(Boolean)
        .join(" ");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setState("loading");
    setMessage("");

    try {
      await createEmployee({
        companyId: String(data.get("companyId") ?? ""),
        areaId: String(data.get("areaId") ?? "") || null,
        positionId: String(data.get("positionId") ?? "") || null,
        teamId: String(data.get("teamId") ?? "") || null,
        managerId: String(data.get("managerId") ?? "") || null,
        firstName: String(data.get("firstName") ?? ""),
        lastName: String(data.get("lastName") ?? ""),
        documentNumber: String(data.get("documentNumber") ?? ""),
        personalEmail: String(data.get("personalEmail") ?? ""),
        phoneMobile: String(data.get("phoneMobile") ?? ""),
        address: String(data.get("address") ?? ""),
        attendancePin: String(data.get("attendancePin") ?? ""),
        hireDate: String(data.get("hireDate") ?? ""),
      });

      form.reset();
      setSelectedCompanyId("");
      setState("success");
      setMessage("Trabajador creado correctamente.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear el trabajador.",
      );
    }
  }

  return (
    <>
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Plus className="h-4 w-4" />
        Nuevo trabajador
      </button>

      {isOpen && isMounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
              role="dialog"
            >
              <div className="animate-rise flex max-h-[calc(100dvh-48px)] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-[#dbe3ee] bg-white shadow-[0_32px_100px_rgba(16,24,40,0.28)]">
                <div className="relative overflow-hidden border-b border-[#e1e5eb] bg-[#f8fafc] px-5 py-4">
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_20%,rgba(79,70,229,0.12),transparent_34%),radial-gradient(circle_at_90%_75%,rgba(56,189,248,0.14),transparent_30%)]" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#4f46e5] text-white shadow-[0_14px_30px_rgba(79,70,229,0.24)]">
                        <UserPlus className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                          Alta de persona
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold leading-7 text-[#1f242d]">
                          Crear trabajador
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667085]">
                          Registra identidad, estructura laboral y seguridad de
                          marcacion en una sola ficha.
                        </p>
                      </div>
                    </div>
                    <button
                      aria-label="Cerrar"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#d8dee8] bg-white text-[#667085] shadow-sm transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
                      disabled={state === "loading"}
                      onClick={closeModal}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <form
                  autoComplete="off"
                  className="max-h-[calc(100dvh-164px)] overflow-y-auto bg-[#f8fafc] px-5 py-5"
                  onSubmit={handleSubmit}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-4">
                      <FormSection
                        description="Datos base para identificar al trabajador en reportes, portal y asistencia."
                        icon={IdCard}
                        title="Identidad"
                      >
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Field label="Nombres">
                            <input
                              autoComplete="off"
                              className={inputClassName}
                              id={firstNameInputId}
                              maxLength={80}
                              name="firstName"
                              placeholder="Ej. Ana"
                              required
                            />
                          </Field>
                          <Field label="Apellidos">
                            <input
                              autoComplete="off"
                              className={inputClassName}
                              id={lastNameInputId}
                              maxLength={80}
                              name="lastName"
                              placeholder="Ej. Torres"
                              required
                            />
                          </Field>
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-[#667085]">
                              DNI
                            </span>
                            <div className="flex gap-2">
                              <input
                                autoComplete="new-password"
                                className={inputClassName}
                                id={documentInputId}
                                inputMode="numeric"
                                maxLength={20}
                                name="documentNumber"
                                pattern="[0-9]*"
                                placeholder="Ej. 70000005"
                              />
                              <IdentityLookupButton
                                documentInputId={documentInputId}
                                onFound={applyIdentityLookup}
                              />
                            </div>
                          </div>
                          <Field label="PIN inicial">
                            <input
                              autoComplete="new-password"
                              className={inputClassName}
                              inputMode="numeric"
                              maxLength={8}
                              minLength={6}
                              name="attendancePin"
                              pattern="[0-9]*"
                              placeholder="Ej. 5837"
                              required
                              type="password"
                            />
                          </Field>
                          <Field label="Correo personal">
                            <input
                              autoComplete="email"
                              className={inputClassName}
                              maxLength={254}
                              name="personalEmail"
                              placeholder="persona@correo.com"
                              type="email"
                            />
                          </Field>
                          <Field label="Celular">
                            <input
                              autoComplete="tel"
                              className={inputClassName}
                              maxLength={25}
                              name="phoneMobile"
                              placeholder="Ej. +51 999 999 999"
                              type="tel"
                            />
                          </Field>
                          <Field label="Dirección">
                            <input
                              autoComplete="street-address"
                              className={inputClassName}
                              maxLength={240}
                              name="address"
                              placeholder="Dirección de residencia"
                            />
                          </Field>
                        </div>
                      </FormSection>

                      <FormSection
                        description="Define donde trabaja, que cargo ocupa y a que equipo responde."
                        icon={BriefcaseBusiness}
                        title="Estructura laboral"
                      >
                        <div className="grid gap-4 lg:grid-cols-3">
                          <Field label="Empresa">
                            <select
                              className={inputClassName}
                              name="companyId"
                              onChange={(event) =>
                                setSelectedCompanyId(event.target.value)
                              }
                              required
                              value={selectedCompanyId}
                            >
                              <option value="">Seleccionar empresa</option>
                              {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Area">
                            <select
                              className={inputClassName}
                              disabled={!selectedCompanyId}
                              key={`area-${selectedCompanyId}`}
                              name="areaId"
                              required
                            >
                              <option value="">Seleccionar area</option>
                              {filteredAreas.map((area) => (
                                <option key={area.id} value={area.id}>
                                  {area.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Cargo">
                            <select
                              className={inputClassName}
                              disabled={!selectedCompanyId}
                              key={`position-${selectedCompanyId}`}
                              name="positionId"
                              required
                            >
                              <option value="">Seleccionar cargo</option>
                              {filteredPositions.map((position) => (
                                <option key={position.id} value={position.id}>
                                  {position.scope === "GROUP"
                                    ? `${position.name} - Grupo`
                                    : position.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Ingreso">
                            <input
                              autoComplete="off"
                              className={inputClassName}
                              name="hireDate"
                              type="date"
                            />
                          </Field>
                          <Field label="Equipo">
                            <select
                              className={inputClassName}
                              disabled={!selectedCompanyId}
                              key={`team-${selectedCompanyId}`}
                              name="teamId"
                            >
                              <option value="">Sin equipo asignado</option>
                              {filteredTeams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Jefe directo">
                            <select
                              className={inputClassName}
                              disabled={!selectedCompanyId}
                              key={`manager-${selectedCompanyId}`}
                              name="managerId"
                            >
                              <option value="">Sin jefe directo</option>
                              {filteredEmployees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.firstName} {employee.lastName}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </FormSection>
                    </div>

                    <aside className="space-y-4">
                      <div className="rounded-[22px] border border-[#dbe3ee] bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f46e5]">
                            <Building2 className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                              Codigo interno
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#1f242d]">
                              {suggestedCode || "Selecciona una empresa"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[#667085]">
                          Se genera por empresa para evitar duplicados y ordenar
                          directorios.
                        </p>
                      </div>

                      <div className="rounded-[22px] border border-[#dbeafe] bg-[#eff6ff] p-4 text-[#1d4ed8]">
                        <p className="flex items-center gap-2 text-sm font-bold">
                          <ShieldCheck className="h-4 w-4" />
                          Marcacion personal
                        </p>
                        <p className="mt-2 text-xs leading-5">
                          El PIN permite registrar entrada y salida con
                          evidencia GPS desde el portal trabajador.
                        </p>
                      </div>

                      <div className="grid gap-2 text-xs font-semibold text-[#475467]">
                        <MiniStep icon={IdCard} label="DNI y nombres" />
                        <MiniStep
                          icon={BriefcaseBusiness}
                          label="Cargo y area"
                        />
                        <MiniStep icon={UsersRound} label="Equipo y jefe" />
                        <MiniStep
                          icon={CalendarDays}
                          label="Fecha de ingreso"
                        />
                        <MiniStep icon={KeyRound} label="PIN inicial" />
                      </div>
                    </aside>
                  </div>

                  <div className="sticky bottom-0 -mx-5 mt-5 border-t border-[#e1e5eb] bg-white/95 px-5 py-4 backdrop-blur">
                    <div className="min-h-9">
                      {state === "loading" ? (
                        <ActionFeedback
                          message="Creando trabajador..."
                          tone="loading"
                        />
                      ) : null}
                      {state === "success" ? (
                        <ActionFeedback message={message} tone="success" />
                      ) : null}
                      {state === "error" ? (
                        <ActionFeedback message={message} tone="error" />
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3] disabled:opacity-60"
                        disabled={state === "loading"}
                        onClick={closeModal}
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca] disabled:opacity-70"
                        disabled={state === "loading"}
                        type="submit"
                      >
                        {state === "loading" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        Crear trabajador
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FormSection({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <section className="rounded-[22px] border border-[#dbe3ee] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f46e5]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h4 className="text-base font-semibold text-[#1f242d]">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-[#667085]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function MiniStep({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#e1e5eb] bg-white px-3 py-2">
      <Icon className="h-4 w-4 text-[#4f46e5]" />
      {label}
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe] disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]";
