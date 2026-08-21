"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { Company } from "@/features/companies/types";
import { IdentityLookupButton } from "@/features/identity-lookup/identity-lookup-button";
import type { IdentityLookupResult } from "@/features/identity-lookup/api";
import type { OrganizationData } from "@/features/organization/types";
import {
  AlertTriangle,
  ArrowRightLeft,
  BriefcaseBusiness,
  Building2,
  Check,
  IdCard,
  KeyRound,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { deleteEmployee, getSuggestedEmployeeCode, transferEmployee, updateEmployee } from "./api";
import { AttendancePinForm } from "./attendance-pin-form";
import type { Employee } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function EmployeeRowActions({
  companies,
  employee,
  organization,
}: {
  companies: Company[];
  employee: Employee;
  organization: OrganizationData;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [deleteState, setDeleteState] = useState<FormState>("idle");
  const [transferState, setTransferState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(employee.company.id);
  const [transferCompanyId, setTransferCompanyId] = useState(employee.company.id);
  const [selectedStatus, setSelectedStatus] = useState<Employee["status"]>(employee.status);
  const [employeeCodeInput, setEmployeeCodeInput] = useState(employee.employeeCode ?? "");
  const [suggestedCode, setSuggestedCode] = useState("");
  const filteredAreas = organization.areas.filter((area) => area.company.id === selectedCompanyId);
  const filteredPositions = organization.positions.filter(
    (position) => position.scope === "GROUP" || position.company?.id === selectedCompanyId,
  );
  const filteredTeams = organization.teams.filter((team) => team.company.id === selectedCompanyId);
  const filteredEmployees = organization.employees.filter(
    (item) => item.company.id === selectedCompanyId && item.id !== employee.id,
  );
  const transferAreas = organization.areas.filter((area) => area.company.id === transferCompanyId);
  const transferClients = organization.clients.filter((client) => client.company.id === transferCompanyId && client.status === "ACTIVE");
  const transferPositions = organization.positions.filter(
    (position) => position.scope === "GROUP" || position.company?.id === transferCompanyId,
  );
  const transferTeams = organization.teams.filter((team) => team.company.id === transferCompanyId);
  const transferManagers = organization.employees.filter(
    (item) => item.company.id === transferCompanyId && item.id !== employee.id,
  );
  const keepsOriginalCompany = selectedCompanyId === employee.company.id;
  const editFormId = `employee-edit-form-${employee.id}`;
  const documentInputId = `employee-document-${employee.id}`;
  const firstNameInputId = `employee-first-name-${employee.id}`;
  const lastNameInputId = `employee-last-name-${employee.id}`;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen && !isDeleteOpen && !isTransferOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && state !== "loading" && deleteState !== "loading" && transferState !== "loading") {
        closeModal();
        closeDeleteModal();
        closeTransferModal();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isDeleteOpen, isTransferOpen, state, deleteState, transferState]);

  useEffect(() => {
    if (!isOpen || employee.employeeCode) {
      return;
    }

    let isCancelled = false;
    setSuggestedCode("");

    getSuggestedEmployeeCode(selectedCompanyId)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        setSuggestedCode(result.code);
        setEmployeeCodeInput((current) => current || result.code);
      })
      .catch(() => {
        if (!isCancelled) {
          setSuggestedCode("");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [employee.employeeCode, isOpen, selectedCompanyId]);

  function closeModal() {
    if (state === "loading") {
      return;
    }

    setIsOpen(false);
    setSelectedCompanyId(employee.company.id);
    setSelectedStatus(employee.status);
    setEmployeeCodeInput(employee.employeeCode ?? "");
    setSuggestedCode("");
    setState("idle");
    setMessage("");
  }

  function closeDeleteModal() {
    if (deleteState === "loading") {
      return;
    }

    setIsDeleteOpen(false);
    setDeleteState("idle");
    setDeleteMessage("");
  }

  function closeTransferModal() {
    if (transferState === "loading") {
      return;
    }

    setIsTransferOpen(false);
    setTransferCompanyId(employee.company.id);
    setTransferState("idle");
    setTransferMessage("");
  }

  function applyIdentityLookup(result: IdentityLookupResult) {
    if (result.tipo !== "DNI") {
      return;
    }

    const firstNameInput = document.getElementById(firstNameInputId) as HTMLInputElement | null;
    const lastNameInput = document.getElementById(lastNameInputId) as HTMLInputElement | null;

    if (firstNameInput) {
      firstNameInput.value = result.nombres;
    }

    if (lastNameInput) {
      lastNameInput.value = [result.apellidoPaterno, result.apellidoMaterno].filter(Boolean).join(" ");
    }
  }

  async function handleDelete() {
    setDeleteState("loading");
    setDeleteMessage("");

    try {
      await deleteEmployee(employee.id);
      setDeleteState("success");
      setDeleteMessage("Ficha laboral eliminada.");
      router.refresh();
      closeDeleteModal();
    } catch (error) {
      setDeleteState("error");
      setDeleteMessage(error instanceof Error ? error.message : "No se pudo eliminar la ficha.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    setState("loading");
    setMessage("");

    try {
      await updateEmployee(employee.id, {
        companyId: String(data.get("companyId") ?? ""),
        areaId: String(data.get("areaId") ?? "") || null,
        positionId: String(data.get("positionId") ?? "") || null,
        teamId: String(data.get("teamId") ?? "") || null,
        managerId: String(data.get("managerId") ?? "") || null,
        firstName: String(data.get("firstName") ?? ""),
        lastName: String(data.get("lastName") ?? ""),
        documentNumber: String(data.get("documentNumber") ?? "") || null,
        employeeCode: String(data.get("employeeCode") ?? "") || null,
        hireDate: String(data.get("hireDate") ?? "") || null,
        status: selectedStatus,
        terminatedAt: String(data.get("terminatedAt") ?? "") || null,
        terminationReason: String(data.get("terminationReason") ?? "") || null,
      });

      setState("success");
      setMessage("Trabajador actualizado.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setTransferState("loading");
    setTransferMessage("");

    try {
      await transferEmployee(employee.id, {
        areaId: String(data.get("areaId") ?? "") || null,
        clientId: String(data.get("clientId") ?? "") || null,
        companyId: String(data.get("companyId") ?? ""),
        effectiveDate: String(data.get("effectiveDate") ?? "") || null,
        isPrimaryClientAssignment: data.get("isPrimaryClientAssignment") === "on",
        managerId: String(data.get("managerId") ?? "") || null,
        positionId: String(data.get("positionId") ?? "") || null,
        reason: String(data.get("reason") ?? "") || null,
        role: String(data.get("role") ?? "") || null,
        teamId: String(data.get("teamId") ?? "") || null,
      });

      setTransferState("success");
      setTransferMessage("Transferencia registrada.");
      router.refresh();
      closeTransferModal();
    } catch (error) {
      setTransferState("error");
      setTransferMessage(error instanceof Error ? error.message : "No se pudo transferir.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="inline-flex h-9 min-w-[88px] items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
        <button
          className="inline-flex h-9 min-w-[106px] items-center justify-center gap-2 rounded-xl border border-[#bfdbfe] bg-white px-3 text-xs font-bold text-[#1d4ed8] transition hover:border-[#60a5fa] hover:bg-[#eff6ff]"
          onClick={() => setIsTransferOpen(true)}
          type="button"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transferir
        </button>
        <button
          className="inline-flex h-9 min-w-[96px] items-center justify-center gap-2 rounded-xl border border-[#fecaca] bg-white px-3 text-xs font-bold text-[#b42318] transition hover:border-[#f97066] hover:bg-[#fff1f0]"
          onClick={() => setIsDeleteOpen(true)}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>

      {isOpen && isMounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
              role="dialog"
            >
              <div className="animate-rise flex max-h-[calc(100dvh-48px)] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-[#dbe3ee] bg-white shadow-[0_32px_100px_rgba(16,24,40,0.28)]">
                <div className="relative overflow-hidden border-b border-[#e1e5eb] bg-[#f8fafc] px-5 py-4">
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_20%,rgba(79,70,229,0.12),transparent_34%),radial-gradient(circle_at_90%_75%,rgba(16,185,129,0.12),transparent_30%)]" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-sm font-bold text-[#4f46e5] shadow-sm">
                        {employee.firstName.slice(0, 1)}
                        {employee.lastName.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                          Ficha de trabajador
                        </p>
                        <h3 className="mt-1 whitespace-normal break-words text-2xl font-semibold leading-7 text-[#1f242d]">
                          {employee.firstName} {employee.lastName}
                        </h3>
                        <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-[#667085]">
                          {employee.company.name} · {employee.position?.name ?? employee.jobTitle ?? "Sin cargo"}
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

                <div className="max-h-[calc(100dvh-164px)] overflow-y-auto bg-[#f8fafc] px-5 py-5">
                  <div className="mb-4 grid gap-3 md:grid-cols-4">
                    <SummaryTile icon={Building2} label="Empresa" value={employee.company.name} />
                    <SummaryTile icon={BriefcaseBusiness} label="Cargo" value={employee.position?.name ?? employee.jobTitle ?? "Pendiente"} />
                    <SummaryTile icon={UsersRound} label="Equipo" value={employee.team?.name ?? "Sin equipo"} />
                    <SummaryTile icon={ShieldCheck} label="Estado" value={statusLabel(selectedStatus)} />
                  </div>

                  <form autoComplete="off" id={editFormId} onSubmit={handleSubmit}>
                    <FormSection
                      description="Actualiza datos personales, estructura laboral y estado de la ficha."
                      icon={IdCard}
                      title="Datos de la ficha"
                    >
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Field label="Empresa">
                        <select
                          className={inputClassName}
                          name="companyId"
                          onChange={(event) => {
                            setSelectedCompanyId(event.target.value);
                            if (!employee.employeeCode) {
                              setEmployeeCodeInput("");
                            }
                          }}
                          required
                          value={selectedCompanyId}
                        >
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Nombres">
                        <input
                          autoComplete="off"
                          className={inputClassName}
                          defaultValue={employee.firstName}
                          id={firstNameInputId}
                          maxLength={80}
                          name="firstName"
                          required
                        />
                      </Field>
                      <Field label="Apellidos">
                        <input
                          autoComplete="off"
                          className={inputClassName}
                          defaultValue={employee.lastName}
                          id={lastNameInputId}
                          maxLength={80}
                          name="lastName"
                          required
                        />
                      </Field>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[#667085]">DNI</span>
                        <div className="flex gap-2">
                          <input
                            autoComplete="new-password"
                            className={inputClassName}
                            defaultValue={employee.documentNumber ?? ""}
                            id={documentInputId}
                            inputMode="numeric"
                            maxLength={20}
                            name="documentNumber"
                            pattern="[0-9]*"
                          />
                          <IdentityLookupButton documentInputId={documentInputId} onFound={applyIdentityLookup} />
                        </div>
                      </div>
                      <Field label="Codigo interno">
                        <input
                          autoComplete="new-password"
                          className={inputClassName}
                          onChange={(event) => setEmployeeCodeInput(event.target.value)}
                          value={employeeCodeInput}
                          maxLength={30}
                          name="employeeCode"
                          placeholder={suggestedCode || "Se genera automatico al guardar"}
                        />
                        <span className="block text-xs leading-5 text-[#667085]">
                          {employee.employeeCode
                            ? "Codigo asignado a esta ficha."
                            : suggestedCode
                              ? `Sugerido para esta empresa: ${suggestedCode}. Si queda vacio, se asignara al guardar.`
                              : "El sistema calcula el siguiente codigo segun la empresa."}
                        </span>
                      </Field>
                      <Field label="Estado">
                        <select
                          className={inputClassName}
                          name="status"
                          onChange={(event) => setSelectedStatus(event.target.value as Employee["status"])}
                          value={selectedStatus}
                        >
                          <option value="ACTIVE">Activo</option>
                          <option value="INACTIVE">Inactivo</option>
                          <option value="TERMINATED">Cesado</option>
                        </select>
                      </Field>
                      <Field label="Area">
                        <select
                          className={inputClassName}
                          defaultValue={keepsOriginalCompany ? employee.areaId ?? "" : ""}
                          key={`area-${selectedCompanyId}`}
                          name="areaId"
                        >
                          <option value="">Sin area asignada</option>
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
                          defaultValue={keepsOriginalCompany ? employee.positionId ?? "" : ""}
                          key={`position-${selectedCompanyId}`}
                          name="positionId"
                        >
                          <option value="">Sin cargo estructurado</option>
                          {filteredPositions.map((position) => (
                            <option key={position.id} value={position.id}>
                              {position.scope === "GROUP" ? `${position.name} - Grupo` : position.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Ingreso">
                        <input autoComplete="off"
                          className={inputClassName}
                          defaultValue={employee.hireDate ? employee.hireDate.slice(0, 10) : ""}
                          name="hireDate"
                          type="date"
                        />
                      </Field>
                      {selectedStatus === "TERMINATED" ? (
                        <>
                          <Field label="Fecha de cese">
                            <input
                              autoComplete="off"
                              className={inputClassName}
                              defaultValue={employee.terminatedAt ? employee.terminatedAt.slice(0, 10) : ""}
                              name="terminatedAt"
                              type="date"
                            />
                          </Field>
                          <label className="space-y-1.5 lg:col-span-2">
                            <span className="text-xs font-semibold text-[#667085]">Observacion del cese</span>
                            <textarea
                              autoComplete="off"
                              className="min-h-[92px] w-full resize-none rounded-xl border border-[#d8dee8] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                              defaultValue={employee.terminationReason ?? ""}
                              maxLength={500}
                              name="terminationReason"
                              placeholder="Ej. Cese por termino de contrato, renuncia, desvinculacion u otra observacion."
                              required
                            />
                          </label>
                        </>
                      ) : null}
                      <Field label="Equipo">
                        <select
                          className={inputClassName}
                          defaultValue={keepsOriginalCompany ? employee.teamId ?? "" : ""}
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
                          defaultValue={keepsOriginalCompany ? employee.managerId ?? "" : ""}
                          key={`manager-${selectedCompanyId}`}
                          name="managerId"
                        >
                          <option value="">Sin jefe directo</option>
                          {filteredEmployees.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.firstName} {item.lastName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    </FormSection>

                  </form>

                  <section className="mt-5 rounded-[22px] border border-[#dbeafe] bg-[#eff6ff] p-4 text-[#1d4ed8]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-bold">
                          <KeyRound className="h-4 w-4" />
                          PIN de marcacion
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#1d4ed8]">
                          Cambia el PIN si el trabajador lo olvido o necesita renovarlo.
                        </p>
                      </div>
                      <AttendancePinForm employeeId={employee.id} />
                    </div>
                  </section>

                  <div className="sticky bottom-0 -mx-5 mt-5 border-t border-[#e1e5eb] bg-white/95 px-5 py-4 backdrop-blur">
                    <div className="min-h-9">
                      {state === "loading" ? <ActionFeedback message="Guardando cambios..." tone="loading" /> : null}
                      {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
                      {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
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
                        form={editFormId}
                        type="submit"
                      >
                        {state === "loading" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isTransferOpen && isMounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
              role="dialog"
            >
              <div className="animate-rise flex max-h-[calc(100dvh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-[26px] border border-[#dbe3ee] bg-white shadow-[0_32px_100px_rgba(16,24,40,0.28)]">
                <div className="border-b border-[#e1e5eb] bg-[#f8fafc] px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#1d4ed8] shadow-sm">
                        <ArrowRightLeft className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                          Transferencia controlada
                        </p>
                        <h3 className="mt-1 whitespace-normal break-words text-2xl font-semibold leading-7 text-[#1f242d]">
                          {employee.firstName} {employee.lastName}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-[#667085]">
                          Registra empresa, estructura destino y asignaciones de cliente sin romper el historial.
                        </p>
                      </div>
                    </div>
                    <button
                      aria-label="Cerrar"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#d8dee8] bg-white text-[#667085] shadow-sm transition hover:border-[#1d4ed8] hover:text-[#1d4ed8] disabled:opacity-60"
                      disabled={transferState === "loading"}
                      onClick={closeTransferModal}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <form className="max-h-[calc(100dvh-164px)] overflow-y-auto bg-[#f8fafc] px-5 py-5" onSubmit={handleTransfer}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="rounded-[22px] border border-[#dbe3ee] bg-white p-4 shadow-sm">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Empresa destino">
                          <select
                            className={inputClassName}
                            name="companyId"
                            onChange={(event) => setTransferCompanyId(event.target.value)}
                            required
                            value={transferCompanyId}
                          >
                            {companies.map((company) => (
                              <option key={company.id} value={company.id}>
                                {company.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Fecha efectiva">
                          <input className={inputClassName} name="effectiveDate" type="date" />
                        </Field>
                        <Field label="Area destino">
                          <select className={inputClassName} key={`transfer-area-${transferCompanyId}`} name="areaId">
                            <option value="">Sin area asignada</option>
                            {transferAreas.map((area) => (
                              <option key={area.id} value={area.id}>{area.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Cargo destino">
                          <select className={inputClassName} key={`transfer-position-${transferCompanyId}`} name="positionId">
                            <option value="">Sin cargo estructurado</option>
                            {transferPositions.map((position) => (
                              <option key={position.id} value={position.id}>
                                {position.scope === "GROUP" ? `${position.name} - Grupo` : position.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Equipo destino">
                          <select className={inputClassName} key={`transfer-team-${transferCompanyId}`} name="teamId">
                            <option value="">Sin equipo asignado</option>
                            {transferTeams.map((team) => (
                              <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Jefe directo">
                          <select className={inputClassName} key={`transfer-manager-${transferCompanyId}`} name="managerId">
                            <option value="">Sin jefe directo</option>
                            {transferManagers.map((item) => (
                              <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Agregar cliente operativo">
                          <select className={inputClassName} key={`transfer-client-${transferCompanyId}`} name="clientId">
                            <option value="">Sin cliente asignado</option>
                            {transferClients.map((client) => (
                              <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Rol en cliente">
                          <input className={inputClassName} maxLength={120} name="role" placeholder="Ej. Coordinador de cuenta" />
                        </Field>
                        <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-sm font-semibold text-[#475467] sm:col-span-2">
                          <input defaultChecked name="isPrimaryClientAssignment" type="checkbox" />
                          Marcar como asignacion principal del trabajador
                        </label>
                        <p className="rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-xs leading-5 text-[#1d4ed8] sm:col-span-2">
                          Un trabajador puede atender varios clientes a la vez. Esta accion agrega una asignacion; si marcas principal, solo cambia cual cliente queda como principal y las demas asignaciones se conservan.
                        </p>
                        <label className="space-y-1.5 sm:col-span-2">
                          <span className="text-xs font-semibold text-[#667085]">Motivo</span>
                          <textarea
                            className="min-h-[92px] w-full resize-none rounded-xl border border-[#d8dee8] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                            maxLength={500}
                            name="reason"
                            placeholder="Ej. Transferencia por nueva asignacion de cliente, cambio de sede o reorganizacion interna."
                          />
                        </label>
                      </div>
                    </div>

                    <aside className="space-y-3">
                      <div className="rounded-[22px] border border-[#bfdbfe] bg-[#eff6ff] p-4 text-[#1d4ed8]">
                        <p className="text-sm font-bold">Este flujo conserva historial</p>
                        <p className="mt-2 text-xs leading-5">
                          La ficha quedara en la estructura destino y se creara un evento en la linea laboral con la fecha efectiva.
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[#e1e5eb] bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Origen actual</p>
                        <div className="mt-3 space-y-2 text-sm">
                          <SummaryLine label="Empresa" value={employee.company.name} />
                          <SummaryLine label="Area" value={employee.areaRef?.name ?? employee.area ?? "Sin area"} />
                          <SummaryLine label="Cargo" value={employee.position?.name ?? employee.jobTitle ?? "Sin cargo"} />
                          <SummaryLine label="Equipo" value={employee.team?.name ?? "Sin equipo"} />
                        </div>
                      </div>
                    </aside>
                  </div>

                  <div className="sticky bottom-0 -mx-5 mt-5 border-t border-[#e1e5eb] bg-white/95 px-5 py-4 backdrop-blur">
                    <div className="min-h-9">
                      {transferState === "loading" ? <ActionFeedback message="Registrando transferencia..." tone="loading" /> : null}
                      {transferState === "success" ? <ActionFeedback message={transferMessage} tone="success" /> : null}
                      {transferState === "error" ? <ActionFeedback message={transferMessage} tone="error" /> : null}
                    </div>
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467]" disabled={transferState === "loading"} onClick={closeTransferModal} type="button">
                        Cancelar
                      </button>
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(29,78,216,0.2)] disabled:opacity-70" disabled={transferState === "loading"} type="submit">
                        {transferState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                        Registrar transferencia
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isDeleteOpen && isMounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
              role="dialog"
            >
              <div className="animate-rise w-full max-w-xl overflow-hidden rounded-[26px] border border-[#fee4e2] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
                <div className="relative overflow-hidden border-b border-[#fee4e2] bg-[#fff7f7] px-5 py-4">
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_20%,rgba(217,45,32,0.14),transparent_36%)]" />
                  <div className="relative flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#d92d20] shadow-sm">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b42318]">
                        Eliminar ficha laboral
                      </p>
                      <h3 className="mt-1 whitespace-normal break-words text-xl font-semibold text-[#1f242d]">
                        {employee.firstName} {employee.lastName}
                      </h3>
                      <p className="mt-1 text-sm text-[#667085]">{employee.company.name}</p>
                    </div>
                    <button
                      aria-label="Cerrar"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] bg-white text-[#667085] transition hover:border-[#d92d20] hover:text-[#d92d20] disabled:opacity-60"
                      disabled={deleteState === "loading"}
                      onClick={closeDeleteModal}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="px-5 py-5">
                  <div className="rounded-[20px] border border-[#fee4e2] bg-[#fffafa] p-4">
                    <p className="text-sm leading-6 text-[#667085]">
                      Esto elimina la ficha de trabajador. Si solo quieres quitarle acceso al sistema, borra el usuario desde
                      Usuarios; la ficha quedara guardada.
                    </p>
                    {employee.user ? (
                      <p className="mt-3 rounded-2xl border border-[#fedf89] bg-[#fffbeb] px-3 py-2 text-xs font-semibold leading-5 text-[#b54708]">
                        Esta ficha esta vinculada a {employee.user.email}. Primero elimina ese acceso desde Usuarios; luego podras borrar la ficha si realmente fue creada por error.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 min-h-9">
                    {deleteState === "loading" ? <ActionFeedback message="Eliminando ficha..." tone="loading" /> : null}
                    {deleteState === "success" ? <ActionFeedback message={deleteMessage} tone="success" /> : null}
                    {deleteState === "error" ? <ActionFeedback message={deleteMessage} tone="error" /> : null}
                  </div>

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3] disabled:opacity-60"
                      disabled={deleteState === "loading"}
                      onClick={closeDeleteModal}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#d92d20] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(217,45,32,0.2)] transition hover:bg-[#b42318] disabled:opacity-70"
                      disabled={deleteState === "loading"}
                      onClick={handleDelete}
                      type="button"
                    >
                      {deleteState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Eliminar ficha
                    </button>
                  </div>
                </div>
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

function SummaryTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#dbe3ee] bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">{label}</p>
          <p className="mt-0.5 truncate text-sm font-bold text-[#1f242d]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f8fafc] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">{label}</p>
      <p className="mt-0.5 whitespace-normal break-words text-sm font-bold text-[#1f242d]">{value}</p>
    </div>
  );
}

function statusLabel(status: Employee["status"]) {
  const labels = {
    ACTIVE: "Activo",
    INACTIVE: "Inactivo",
    TERMINATED: "Cesado",
  };

  return labels[status];
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe] disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]";
