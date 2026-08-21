"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { Company } from "@/features/companies/types";
import { getEmployees, getSuggestedEmployeeCode } from "@/features/employees/api";
import type { Employee } from "@/features/employees/types";
import { IdentityLookupButton } from "@/features/identity-lookup/identity-lookup-button";
import type { IdentityLookupResult } from "@/features/identity-lookup/api";
import type { OrganizationData } from "@/features/organization/types";
import { mediaUrl } from "@/lib/api";
import { ImagePlus, Loader2, Plus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createUser, uploadUserImage } from "./api";
import type { AppRole, AppUser } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function CreateUserForm({
  companies,
  organization,
  roles,
}: {
  companies: Company[];
  organization: OrganizationData;
  roles: AppRole[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [accessMode, setAccessMode] = useState<"admin" | "portal" | "both">("admin");
  const [profileMode, setProfileMode] = useState<"new" | "existing">("new");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployeeCompanyId, setSelectedEmployeeCompanyId] = useState("");
  const [suggestedEmployeeCode, setSuggestedEmployeeCode] = useState("");
  const [unlinkedEmployees, setUnlinkedEmployees] = useState<Employee[]>([]);
  const [uploadState, setUploadState] = useState<FormState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filteredAreas = organization.areas.filter((area) => area.company.id === selectedEmployeeCompanyId);
  const filteredPositions = organization.positions.filter(
    (position) => position.scope === "GROUP" || position.company?.id === selectedEmployeeCompanyId,
  );
  const filteredTeams = organization.teams.filter((team) => team.company.id === selectedEmployeeCompanyId);
  const filteredEmployees = organization.employees.filter((employee) => employee.company.id === selectedEmployeeCompanyId);
  const documentInputId = "create-user-document-number";

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
    if (!isOpen || accessMode === "admin") {
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
  }, [isOpen, accessMode]);

  useEffect(() => {
    if (!isOpen || accessMode === "admin" || profileMode !== "new" || !selectedEmployeeCompanyId) {
      setSuggestedEmployeeCode("");
      return;
    }

    let isCancelled = false;
    setSuggestedEmployeeCode("");

    getSuggestedEmployeeCode(selectedEmployeeCompanyId)
      .then((result) => {
        if (!isCancelled) {
          setSuggestedEmployeeCode(result.code);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSuggestedEmployeeCode("");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accessMode, isOpen, profileMode, selectedEmployeeCompanyId]);

  function closeModal() {
    if (state === "loading") {
      return;
    }

    setIsOpen(false);
    setState("idle");
    setMessage("");
    setUploadState("idle");
    setUploadMessage("");
    setAccessMode("admin");
    setProfileMode("new");
    setFirstName("");
    setLastName("");
    setSelectedEmployeeId("");
    setSelectedEmployeeCompanyId("");
    setSuggestedEmployeeCode("");
  }

  function handleAccessModeChange(value: "admin" | "portal" | "both") {
    setAccessMode(value);

    if (value === "admin") {
      setProfileMode("new");
      setSelectedEmployeeId("");
    }
  }

  function handleProfileModeChange(value: "new" | "existing") {
    setProfileMode(value);

    if (value === "new") {
      setSelectedEmployeeId("");
      setSuggestedEmployeeCode("");
    }
  }

  function handleEmployeeSelect(employeeId: string) {
    setSelectedEmployeeId(employeeId);

    const employee = unlinkedEmployees.find((item) => item.id === employeeId);
    if (!employee) {
      return;
    }

    setFirstName(employee.firstName);
    setLastName(employee.lastName);
  }

  function applyIdentityLookup(result: IdentityLookupResult) {
    if (result.tipo !== "DNI") {
      return;
    }

    setFirstName(result.nombres);
    setLastName([result.apellidoPaterno, result.apellidoMaterno].filter(Boolean).join(" "));
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
      const isExistingEmployee = String(data.get("employeeId") ?? "") !== "";
      await createUser({
        accessMode: String(data.get("accessMode") ?? "admin") as "admin" | "portal" | "both",
        companyId: String(data.get("companyId") || "") || null,
        employeeId: String(data.get("employeeId") ?? ""),
        employeeCompanyId: String(data.get("employeeCompanyId") ?? ""),
        roleId: String(data.get("roleId") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        firstName: String(data.get("firstName") ?? ""),
        lastName: String(data.get("lastName") ?? ""),
        avatarUrl,
        status: String(data.get("status") ?? "ACTIVE") as AppUser["status"],
        documentNumber: isExistingEmployee ? undefined : String(data.get("documentNumber") ?? ""),
        employeeCode: isExistingEmployee ? undefined : String(data.get("employeeCode") ?? ""),
        attendancePin: isExistingEmployee ? undefined : String(data.get("attendancePin") ?? ""),
        areaId: isExistingEmployee ? undefined : String(data.get("areaId") ?? "") || null,
        positionId: isExistingEmployee ? undefined : String(data.get("positionId") ?? "") || null,
        teamId: isExistingEmployee ? undefined : String(data.get("teamId") ?? "") || null,
        managerId: isExistingEmployee ? undefined : String(data.get("managerId") ?? "") || null,
        jobTitle: isExistingEmployee ? undefined : String(data.get("jobTitle") ?? ""),
        area: isExistingEmployee ? undefined : String(data.get("area") ?? ""),
        hireDate: isExistingEmployee ? undefined : String(data.get("hireDate") ?? ""),
      });

      form.reset();
      setAvatarUrl("");
      setFirstName("");
      setLastName("");
      setSelectedEmployeeId("");
      setState("success");
      setMessage("Usuario creado correctamente.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear el usuario.");
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
        Nuevo usuario
      </button>

      {isOpen && isMounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
              role="dialog"
            >
              <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Nuevo acceso
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">
                      Crear usuario del sistema
                    </h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      Define acceso, permisos y ficha laboral cuando el usuario tendra portal trabajador.
                    </p>
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

                  <div className="mb-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Tipo de acceso
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {[
                        {
                          description: "Solo herramientas administrativas.",
                          label: "Panel admin",
                          value: "admin",
                        },
                        {
                          description: "Solo portal, marcacion y ficha.",
                          label: "Portal trabajador",
                          value: "portal",
                        },
                        {
                          description: "Admin y portal trabajador.",
                          label: "Ambos accesos",
                          value: "both",
                        },
                      ].map((option) => (
                        <label
                          className={`cursor-pointer rounded-2xl border p-3 transition ${
                            accessMode === option.value
                              ? "border-[#4f46e5] bg-[#f7f7ff] shadow-[0_10px_24px_rgba(79,70,229,0.12)]"
                              : "border-[#e1e5eb] bg-white hover:border-[#c7d2fe]"
                          }`}
                          key={option.value}
                        >
                          <input
                            autoComplete="off"
                            checked={accessMode === option.value}
                            className="sr-only"
                            name="accessMode"
                            onChange={() => handleAccessModeChange(option.value as "admin" | "portal" | "both")}
                            type="radio"
                            value={option.value}
                          />
                          <span className="block text-sm font-semibold text-[#1f242d]">{option.label}</span>
                          <span className="mt-1 block text-xs leading-4 text-[#667085]">{option.description}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#667085]">
                      El acceso administrativo define que empresas puede gestionar. La ficha laboral define donde trabaja.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <Field label="Nombres">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        name="firstName"
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="Ej. Ana"
                        readOnly={profileMode === "existing" && Boolean(selectedEmployeeId)}
                        required
                        value={firstName}
                      />
                    </Field>
                    <Field label="Apellidos">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        name="lastName"
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Ej. Torres"
                        readOnly={profileMode === "existing" && Boolean(selectedEmployeeId)}
                        required
                        value={lastName}
                      />
                    </Field>
                    <Field label="Correo">
                      <input autoComplete="off" className={inputClassName} name="email" placeholder="correo@empresa.com" required type="email" />
                    </Field>
                    <Field label="Rol">
                      <select className={inputClassName} name="roleId" required>
                        <option value="">Seleccionar rol</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {accessMode !== "portal" ? (
                      <Field label="Acceso administrativo">
                        <select className={inputClassName} name="companyId">
                          <option value="">Grupo completo</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <input autoComplete="off" name="companyId" type="hidden" value="" />
                    )}
                    <Field label="Estado">
                      <select className={inputClassName} name="status">
                        <option value="ACTIVE">Activo</option>
                        <option value="INVITED">Invitado</option>
                        <option value="INACTIVE">Inactivo</option>
                      </select>
                    </Field>
                    <Field label="Contraseña inicial">
                      <input autoComplete="off" className={inputClassName} name="password" placeholder="Minimo 8 caracteres" required type="password" />
                    </Field>

                    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085] lg:col-span-2">
                      <p className="flex items-center gap-2 font-semibold text-[#344054]">
                        <UserPlus className="h-4 w-4 text-[#4f46e5]" />
                        Acceso inicial
                      </p>
                      <p className="mt-1">
                        El usuario podrá entrar con esta contraseña temporal. Luego podrá cambiarse desde seguridad de cuenta.
                      </p>
                    </div>
                  </div>

                  {accessMode !== "admin" ? (
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
                          Esta ficha alimenta marcacion, solicitudes, documentos, equipo y portal trabajador.
                        </p>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <label
                          className={`cursor-pointer rounded-2xl border p-3 transition ${
                            profileMode === "new"
                              ? "border-[#4f46e5] bg-[#f7f7ff]"
                              : "border-[#e1e5eb] bg-white hover:border-[#c7d2fe]"
                          }`}
                        >
                          <input
                            checked={profileMode === "new"}
                            className="sr-only"
                            onChange={() => handleProfileModeChange("new")}
                            type="radio"
                          />
                          <span className="block text-sm font-semibold text-[#1f242d]">Crear ficha nueva</span>
                          <span className="mt-1 block text-xs leading-4 text-[#667085]">Para personas que aun no existen en Trabajadores.</span>
                        </label>
                        <label
                          className={`cursor-pointer rounded-2xl border p-3 transition ${
                            profileMode === "existing"
                              ? "border-[#4f46e5] bg-[#f7f7ff]"
                              : "border-[#e1e5eb] bg-white hover:border-[#c7d2fe]"
                          }`}
                        >
                          <input
                            checked={profileMode === "existing"}
                            className="sr-only"
                            onChange={() => {
                              handleProfileModeChange("existing");
                              setSuggestedEmployeeCode("");
                            }}
                            type="radio"
                          />
                          <span className="block text-sm font-semibold text-[#1f242d]">Usar ficha existente sin acceso</span>
                          <span className="mt-1 block text-xs leading-4 text-[#667085]">Para dar login a alguien que ya tiene ficha laboral.</span>
                        </label>
                      </div>

                      {profileMode === "existing" ? (
                        <div className="mt-4">
                          <Field label="Ficha laboral sin usuario">
                            <select
                              className={inputClassName}
                              name="employeeId"
                              onChange={(event) => handleEmployeeSelect(event.target.value)}
                              required
                              value={selectedEmployeeId}
                            >
                              <option value="">Seleccionar trabajador sin acceso</option>
                              {unlinkedEmployees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.firstName} {employee.lastName} · {employee.company.name} · {employee.jobTitle ?? employee.position?.name ?? "Sin cargo"}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <p className="mt-2 text-xs leading-5 text-[#667085]">
                            Al guardar, el usuario quedara conectado a esa ficha. No se creara un trabajador duplicado.
                          </p>
                        </div>
                      ) : (
                        <>
                          <input name="employeeId" type="hidden" value="" />
                          <input name="employeeCode" type="hidden" value="" />
                          <div className="mt-4 grid gap-4 lg:grid-cols-3">
                            <Field label="Empresa laboral">
                              <select
                                className={inputClassName}
                                name="employeeCompanyId"
                                onChange={(event) => setSelectedEmployeeCompanyId(event.target.value)}
                                required
                                value={selectedEmployeeCompanyId}
                              >
                                <option value="">Seleccionar empresa</option>
                                {companies.map((company) => (
                                  <option key={company.id} value={company.id}>
                                    {company.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <div className="rounded-2xl border border-[#d8dee8] bg-white px-3 py-2 lg:col-span-2">
                              <p className="text-xs font-semibold text-[#667085]">Codigo interno de ficha</p>
                              <p className="mt-1 text-sm font-semibold text-[#1f242d]">
                                {suggestedEmployeeCode || "Selecciona la empresa laboral"}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-[#667085]">
                                Se asigna automaticamente al guardar para evitar duplicados.
                              </p>
                            </div>
                            <Field label="Area">
                              <select
                                className={inputClassName}
                                disabled={!selectedEmployeeCompanyId}
                                key={`user-create-area-${selectedEmployeeCompanyId}`}
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
                                disabled={!selectedEmployeeCompanyId}
                                key={`user-create-position-${selectedEmployeeCompanyId}`}
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
                            <div className="space-y-1.5">
                              <span className="text-xs font-semibold text-[#667085]">DNI o documento</span>
                              <div className="flex gap-2">
                                <input
                                  autoComplete="off"
                                  className={inputClassName}
                                  id={documentInputId}
                                  maxLength={20}
                                  name="documentNumber"
                                  placeholder="Ej. 70000001"
                                />
                                <IdentityLookupButton documentInputId={documentInputId} onFound={applyIdentityLookup} />
                              </div>
                            </div>
                            <Field label="Fecha de ingreso">
                              <input autoComplete="off" className={inputClassName} name="hireDate" type="date" />
                            </Field>
                            <Field label="Equipo">
                              <select
                                className={inputClassName}
                                disabled={!selectedEmployeeCompanyId}
                                key={`user-create-team-${selectedEmployeeCompanyId}`}
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
                                disabled={!selectedEmployeeCompanyId}
                                key={`user-create-manager-${selectedEmployeeCompanyId}`}
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
                            <Field label="PIN de marcacion">
                              <input
                                autoComplete="new-password"
                                className={inputClassName}
                                inputMode="numeric"
                                maxLength={8}
                                minLength={4}
                                name="attendancePin"
                                pattern="[0-9]*"
                                placeholder="Ej. 5837"
                                required
                                type="password"
                              />
                            </Field>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-5 border-t border-[#e1e5eb] pt-4">
                    <div className="min-h-9">
                      {state === "loading" ? <ActionFeedback message="Creando usuario..." tone="loading" /> : null}
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
                          <Plus className="h-4 w-4" />
                        )}
                        Crear usuario
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

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
