"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { AuthUser } from "@/features/auth/types";
import type { Company } from "@/features/companies/types";
import { getEmployees } from "@/features/employees/api";
import type { Employee } from "@/features/employees/types";
import { IdentityLookupButton } from "@/features/identity-lookup/identity-lookup-button";
import type { IdentityLookupResult } from "@/features/identity-lookup/api";
import type { OrganizationData } from "@/features/organization/types";
import { mediaUrl } from "@/lib/api";
import { AlertTriangle, Check, ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deleteUser, updateUser, uploadUserImage } from "./api";
import type { AppRole, AppUser } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function UserRowActions({
  companies,
  currentUser,
  organization,
  roles,
  user,
}: {
  companies: Company[];
  currentUser: AuthUser | null;
  organization: OrganizationData;
  roles: AppRole[];
  user: AppUser;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [selectedEmployeeCompanyId, setSelectedEmployeeCompanyId] = useState(user.employee?.company.id ?? "");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [unlinkedEmployees, setUnlinkedEmployees] = useState<Employee[]>([]);
  const [uploadState, setUploadState] = useState<FormState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canDelete =
    currentUser?.id !== user.id &&
    (currentUser?.role?.name === "Admin Grupo" || currentUser?.role?.name === "Super Admin");
  const filteredAreas = organization.areas.filter((area) => area.company.id === selectedEmployeeCompanyId);
  const filteredPositions = organization.positions.filter(
    (position) => position.scope === "GROUP" || position.company?.id === selectedEmployeeCompanyId,
  );
  const filteredTeams = organization.teams.filter((team) => team.company.id === selectedEmployeeCompanyId);
  const filteredEmployees = organization.employees.filter(
    (employee) => employee.company.id === selectedEmployeeCompanyId && employee.id !== user.employee?.id,
  );
  const keepsOriginalEmployeeCompany = selectedEmployeeCompanyId === user.employee?.company.id;
  const documentInputId = `user-document-${user.id}`;
  const firstNameInputId = `user-first-name-${user.id}`;
  const lastNameInputId = `user-last-name-${user.id}`;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen && !isDeleteOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && state !== "loading") {
        setIsOpen(false);
        setIsDeleteOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeleteOpen, isOpen, state]);

  useEffect(() => {
    if (!isOpen || user.employee) {
      return;
    }

    let isCancelled = false;

    getEmployees({ pageSize: 100 })
      .then((employees) => {
        if (!isCancelled) {
          setUnlinkedEmployees(employees.filter((employee) => !employee.user));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setUnlinkedEmployees([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, user.employee]);

  function closeModal() {
    if (state === "loading") {
      return;
    }

    setIsOpen(false);
    setState("idle");
    setMessage("");
    setSelectedEmployeeCompanyId(user.employee?.company.id ?? "");
    setSelectedEmployeeId("");
    setUploadState("idle");
    setUploadMessage("");
  }

  function closeDeleteModal() {
    if (state === "loading") {
      return;
    }

    setIsDeleteOpen(false);
    setState("idle");
    setMessage("");
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

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadState("error");
      setUploadMessage("Solo JPG, PNG o WebP.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadState("error");
      setUploadMessage("La imagen debe pesar maximo 50 MB.");
      return;
    }

    setUploadState("loading");
    setUploadMessage("");

    try {
      const uploaded = await uploadUserImage(file);
      setAvatarUrl(uploaded.url);
      setUploadState("success");
      setUploadMessage("Imagen lista.");
    } catch (error) {
      setUploadState("error");
      setUploadMessage(error instanceof Error ? error.message : "No se pudo subir la imagen.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setState("loading");
    setMessage("");

    try {
      await updateUser(user.id, {
        companyId: String(data.get("companyId") ?? "") || null,
        employeeId: String(data.get("employeeId") ?? "") || null,
        employeeCompanyId: String(data.get("employeeCompanyId") ?? ""),
        firstName: String(data.get("firstName") ?? ""),
        lastName: String(data.get("lastName") ?? ""),
        avatarUrl,
        password: String(data.get("password") ?? "") || undefined,
        roleId: String(data.get("roleId") ?? ""),
        status: String(data.get("status") ?? "ACTIVE") as AppUser["status"],
        documentNumber: String(data.get("documentNumber") ?? ""),
        employeeCode: String(data.get("employeeCode") ?? ""),
        attendancePin: String(data.get("attendancePin") ?? ""),
        areaId: String(data.get("areaId") ?? "") || null,
        positionId: String(data.get("positionId") ?? "") || null,
        teamId: String(data.get("teamId") ?? "") || null,
        managerId: String(data.get("managerId") ?? "") || null,
        jobTitle: String(data.get("jobTitle") ?? ""),
        area: String(data.get("area") ?? ""),
        hireDate: String(data.get("hireDate") ?? ""),
      });

      setState("success");
      setMessage("Usuario actualizado.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  async function handleDelete() {
    setState("loading");
    setMessage("");

    try {
      await deleteUser(user.id);
      setState("success");
      setMessage("Usuario eliminado.");
      router.refresh();
      closeDeleteModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    }
  }

  return (
    <>
      <div className="inline-flex items-center justify-end gap-2">
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
        {canDelete ? (
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#fecaca] bg-white px-3 text-xs font-bold text-[#b42318] transition hover:border-[#ef4444] hover:bg-[#fff1f2]"
            onClick={() => setIsDeleteOpen(true)}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        ) : null}
      </div>

      {isOpen && isMounted
        ? createPortal(
        <div
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
          role="dialog"
        >
          <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Editar acceso
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">
                  {user.firstName} {user.lastName}
                </h3>
                <p className="mt-1 whitespace-normal break-all text-sm leading-5 text-[#667085]">{user.email}</p>
              </div>
              <button
                aria-label="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
                disabled={state === "loading"}
                onClick={closeModal}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form autoComplete="off" className="max-h-[calc(100dvh-156px)] overflow-y-auto px-5 py-5" onSubmit={handleSubmit}>
              <input autoComplete="off" name="avatarUrl" type="hidden" value={avatarUrl} />
              <div className="mb-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
                <input autoComplete="off"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef2ff] text-sm font-bold text-[#4f46e5]">
                      {avatarUrl ? (
                        <img alt="Foto de usuario" className="h-full w-full object-cover" src={mediaUrl(avatarUrl)} />
                      ) : (
                        <ImagePlus className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1f242d]">Foto de perfil</p>
                      <p className="mt-0.5 text-xs leading-5 text-[#667085]">JPG, PNG o WebP. Maximo 50 MB.</p>
                      {uploadMessage ? (
                        <p className={`mt-1 text-xs font-semibold ${uploadState === "error" ? "text-[#b42318]" : "text-[#027a48]"}`}>
                          {uploadMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {avatarUrl ? (
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#98a2b3]"
                        onClick={() => setAvatarUrl("")}
                        type="button"
                      >
                        Quitar
                      </button>
                    ) : null}
                    <button
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
                      disabled={uploadState === "loading"}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      {uploadState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      Subir imagen
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombres">
                  <input autoComplete="off"
                    className={inputClassName}
                    defaultValue={user.firstName}
                    id={firstNameInputId}
                    name="firstName"
                    placeholder="Nombres"
                    required
                  />
                </Field>
                <Field label="Apellidos">
                  <input autoComplete="off"
                    className={inputClassName}
                    defaultValue={user.lastName}
                    id={lastNameInputId}
                    name="lastName"
                    placeholder="Apellidos"
                    required
                  />
                </Field>
                <Field label="Rol">
                  <select className={inputClassName} defaultValue={user.role?.id ?? ""} name="roleId" required>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Acceso por empresa">
                  <select className={inputClassName} defaultValue={user.company?.id ?? ""} name="companyId">
                    <option value="">Grupo completo</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado">
                  <select className={inputClassName} defaultValue={user.status} name="status">
                    <option value="ACTIVE">Activo</option>
                    <option value="INVITED">Invitado</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                </Field>
                <Field label="Nueva contraseña">
                  <input
                    autoComplete="new-password"
                    className={inputClassName}
                    minLength={8}
                    name="password"
                    placeholder="Solo si quieres cambiarla"
                    type="password"
                  />
                </Field>

                <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085]">
                  <p className="font-semibold text-[#344054]">Permiso aplicado</p>
                  <p className="mt-1">
                  El rol define que puede ver o gestionar. El acceso por empresa define si trabaja con todo el grupo o solo con una empresa.
                  </p>
                </div>
              </div>

              {!user.employee ? (
                <div className="mt-4 rounded-2xl border border-[#d8dee8] bg-[#fbfcfd] p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                        Portal trabajador
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-[#1f242d]">
                        Conectar ficha laboral existente
                      </h4>
                    </div>
                    <p className="max-w-md text-xs leading-5 text-[#667085]">
                      Usa esto para dar portal trabajador a un usuario administrativo sin crear una ficha duplicada.
                    </p>
                  </div>

                  <div className="mt-4">
                    <Field label="Ficha laboral sin usuario">
                      <select
                        className={inputClassName}
                        name="employeeId"
                        onChange={(event) => setSelectedEmployeeId(event.target.value)}
                        value={selectedEmployeeId}
                      >
                        <option value="">No conectar por ahora</option>
                        {unlinkedEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName} · {employee.company.name} · {employee.position?.name ?? employee.jobTitle ?? "Sin cargo"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="mt-2 text-xs leading-5 text-[#667085]">
                      Al guardar, este usuario podra entrar tambien al portal trabajador si su rol tiene permisos de portal o asistencia.
                    </p>
                  </div>
                </div>
              ) : (
                <input name="employeeId" type="hidden" value="" />
              )}

              {user.employee ? (
                <div className="mt-4 rounded-2xl border border-[#d8dee8] bg-[#fbfcfd] p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                        Ficha laboral
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-[#1f242d]">
                        Datos del trabajador
                      </h4>
                    </div>
                    <p className="max-w-md text-xs leading-5 text-[#667085]">
                      Estos datos alimentan portal, marcacion, solicitudes, documentos y reportes.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <Field label="Empresa laboral">
                      <select
                        className={inputClassName}
                        name="employeeCompanyId"
                        onChange={(event) => setSelectedEmployeeCompanyId(event.target.value)}
                        required
                        value={selectedEmployeeCompanyId}
                      >
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cargo">
                      <select
                        className={inputClassName}
                        defaultValue={keepsOriginalEmployeeCompany ? user.employee.positionId ?? "" : ""}
                        disabled={!selectedEmployeeCompanyId}
                        key={`user-edit-position-${user.id}-${selectedEmployeeCompanyId}`}
                        name="positionId"
                        required
                      >
                        <option value="">Seleccionar cargo</option>
                        {filteredPositions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.scope === "GROUP" ? `${position.name} - Grupo` : position.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Area">
                      <select
                        className={inputClassName}
                        defaultValue={keepsOriginalEmployeeCompany ? user.employee.areaId ?? "" : ""}
                        disabled={!selectedEmployeeCompanyId}
                        key={`user-edit-area-${user.id}-${selectedEmployeeCompanyId}`}
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
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-[#667085]">DNI o documento</span>
                      <div className="flex gap-2">
                        <input
                          autoComplete="off"
                          className={inputClassName}
                          defaultValue={user.employee.documentNumber ?? ""}
                          id={documentInputId}
                          maxLength={20}
                          name="documentNumber"
                          placeholder="Ej. 70000001"
                        />
                        <IdentityLookupButton documentInputId={documentInputId} onFound={applyIdentityLookup} />
                      </div>
                    </div>
                    <Field label="Codigo trabajador">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        defaultValue={user.employee.employeeCode ?? ""}
                        maxLength={24}
                        name="employeeCode"
                        placeholder="Se genera si lo dejas vacio"
                      />
                    </Field>
                    <Field label="Fecha de ingreso">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        defaultValue={toDateInputValue(user.employee.hireDate)}
                        name="hireDate"
                        type="date"
                      />
                    </Field>
                    <Field label="Equipo">
                      <select
                        className={inputClassName}
                        defaultValue={keepsOriginalEmployeeCompany ? user.employee.teamId ?? "" : ""}
                        disabled={!selectedEmployeeCompanyId}
                        key={`user-edit-team-${user.id}-${selectedEmployeeCompanyId}`}
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
                        defaultValue={keepsOriginalEmployeeCompany ? user.employee.managerId ?? "" : ""}
                        disabled={!selectedEmployeeCompanyId}
                        key={`user-edit-manager-${user.id}-${selectedEmployeeCompanyId}`}
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
                    <Field label="Nuevo PIN de marcacion">
                      <input
                        autoComplete="new-password"
                        className={inputClassName}
                        inputMode="numeric"
                        maxLength={8}
                        name="attendancePin"
                        placeholder="Solo si quieres cambiarlo"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 border-t border-[#e1e5eb] pt-4">
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
          <div className="animate-rise w-full max-w-lg overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fee4e2] text-[#b42318]">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                    Confirmar eliminacion
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">
                    Eliminar acceso de {user.firstName} {user.lastName}
                  </h3>
                </div>
              </div>
              <button
                aria-label="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#ef4444] hover:text-[#b42318] disabled:opacity-60"
                disabled={state === "loading"}
                onClick={closeDeleteModal}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm leading-6 text-[#667085]">
                Se quitara el acceso al sistema para <strong className="text-[#1f242d]">{user.email}</strong>. Si este usuario esta vinculado a una ficha laboral, la ficha se conserva para no perder informacion del trabajador.
              </p>

              <div className="mt-4 rounded-2xl border border-[#fee4e2] bg-[#fff7f7] p-3 text-sm text-[#b42318]">
                Esta accion no elimina trabajadores, asistencia ni documentos. Solo elimina la cuenta de acceso.
              </div>

              <div className="mt-5 min-h-9">
                {state === "loading" ? <ActionFeedback message="Eliminando usuario..." tone="loading" /> : null}
                {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
                {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
              </div>

              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3] disabled:opacity-60"
                  disabled={state === "loading"}
                  onClick={closeDeleteModal}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#dc2626] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(220,38,38,0.2)] transition hover:bg-[#b91c1c] disabled:opacity-70"
                  disabled={state === "loading"}
                  onClick={handleDelete}
                  type="button"
                >
                  {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Eliminar usuario
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

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
