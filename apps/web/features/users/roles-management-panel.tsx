"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { CrudSection } from "@/components/ui/crud-section";
import { DataTable, DataTableCell, DataTableHead, DataTableHeader } from "@/components/ui/data-table";
import type { AuthUser } from "@/features/auth/types";
import { AlertTriangle, Check, KeyRound, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createRole, deleteRole, updateRole } from "./api";
import type { AppRole } from "./types";

type FormState = "idle" | "loading" | "success" | "error";
type ModalMode = "create" | "edit";

const permissionGroups = [
  {
    module: "Empresas",
    permissions: [{ key: "companies.manage", label: "Gestionar empresas" }],
  },
  {
    module: "Trabajadores",
    permissions: [
      { key: "employees.view", label: "Ver trabajadores" },
      { key: "employees.manage", label: "Crear y editar trabajadores" },
    ],
  },
  {
    module: "Organizacion",
    permissions: [
      { key: "organization.view", label: "Ver areas, cargos y equipos" },
      { key: "organization.manage", label: "Gestionar areas, cargos y equipos" },
    ],
  },
  {
    module: "Asistencia",
    permissions: [
      { key: "attendance.view", label: "Ver asistencia" },
      { key: "attendance.manage", label: "Gestionar asistencia" },
      { key: "attendance.mark", label: "Marcar entrada y salida" },
    ],
  },
  {
    module: "Solicitudes",
    permissions: [
      { key: "requests.view", label: "Ver solicitudes" },
      { key: "requests.create", label: "Crear solicitudes" },
      { key: "requests.approve", label: "Aprobar o rechazar" },
    ],
  },
  {
    module: "Documentos",
    permissions: [
      { key: "documents.view", label: "Ver documentos" },
      { key: "documents.manage", label: "Gestionar documentos" },
    ],
  },
  {
    module: "Beneficios",
    permissions: [
      { key: "benefits.view", label: "Ver beneficios" },
      { key: "benefits.manage", label: "Gestionar beneficios" },
    ],
  },
  {
    module: "Comunicados",
    permissions: [
      { key: "announcements.view", label: "Ver comunicados" },
      { key: "announcements.manage", label: "Gestionar comunicados" },
    ],
  },
  {
    module: "Notificaciones",
    permissions: [
      { key: "notifications.view", label: "Ver notificaciones" },
      { key: "notifications.manage", label: "Gestionar notificaciones" },
    ],
  },
  {
    module: "Automatizaciones",
    permissions: [
      { key: "automations.view", label: "Ver automatizaciones" },
      { key: "automations.manage", label: "Gestionar automatizaciones" },
    ],
  },
  {
    module: "Usuarios",
    permissions: [{ key: "users.manage", label: "Gestionar usuarios y roles" }],
  },
  {
    module: "Auditoria",
    permissions: [{ key: "audit.view", label: "Ver trazabilidad" }],
  },
];

const permissionLabels = new Map(
  permissionGroups.flatMap((group) => group.permissions.map((permission) => [permission.key, permission.label])),
);

const systemRoleNames = new Set(["Super Admin", "Admin Grupo", "RRHH", "Gerencia", "Jefe de Area", "Trabajador"]);

export function RolesManagementPanel({ currentUser, roles }: { currentUser: AuthUser | null; roles: AppRole[] }) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("create");
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const visibleRoles = useMemo(() => roles.slice().sort((a, b) => a.name.localeCompare(b.name)), [roles]);
  const canDeleteCustomRoles = currentUser?.role?.name === "Admin Grupo" || currentUser?.role?.name === "Super Admin";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen && !isDeleteOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && state !== "loading") {
        closeModal();
        closeDeleteModal();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeleteOpen, isOpen, state]);

  function openCreateModal() {
    setMode("create");
    setSelectedRole(null);
    setState("idle");
    setMessage("");
    setIsOpen(true);
  }

  function openEditModal(role: AppRole) {
    setMode("edit");
    setSelectedRole(role);
    setState("idle");
    setMessage("");
    setIsOpen(true);
  }

  function closeModal() {
    if (state === "loading") {
      return;
    }

    setIsOpen(false);
    setState("idle");
    setMessage("");
  }

  function openDeleteModal(role: AppRole) {
    setSelectedRole(role);
    setState("idle");
    setMessage("");
    setIsDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (state === "loading") {
      return;
    }

    setIsDeleteOpen(false);
    setState("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const permissions = data.getAll("permissions").map((value) => String(value));
    const payload = {
      description: String(data.get("description") ?? ""),
      name: String(data.get("name") ?? ""),
      permissions,
    };

    setState("loading");
    setMessage("");

    try {
      if (mode === "edit" && selectedRole) {
        await updateRole(selectedRole.id, payload);
        setMessage("Rol actualizado.");
      } else {
        await createRole(payload);
        form.reset();
        setMessage("Rol creado.");
      }

      setState("success");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el rol.");
    }
  }

  async function handleDeleteRole() {
    if (!selectedRole) {
      return;
    }

    setState("loading");
    setMessage("");

    try {
      await deleteRole(selectedRole.id);
      setState("success");
      setMessage("Rol eliminado.");
      router.refresh();
      closeDeleteModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el rol.");
    }
  }

  return (
    <CrudSection
      actions={
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca]"
          onClick={openCreateModal}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nuevo rol
        </button>
      }
      className="mt-3"
      description="Define que puede ver o gestionar cada perfil dentro del sistema."
      eyebrow="Roles y permisos"
      title="Accesos por perfil"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleRoles.map((role) => (
          <article
            className="group rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-3.5 transition hover:-translate-y-0.5 hover:border-[#b8c7e6] hover:bg-white hover:shadow-[0_16px_36px_rgba(15,23,42,0.06)]"
            key={role.id}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef2ff] text-[#4f46e5] shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#d8dee8] bg-white px-2.5 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
                  onClick={() => openEditModal(role)}
                  type="button"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                {canDeleteCustomRoles && !systemRoleNames.has(role.name) ? (
                  <button
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#fecaca] bg-white px-2.5 text-xs font-bold text-[#b42318] transition hover:border-[#ef4444] hover:bg-[#fff1f2]"
                    onClick={() => openDeleteModal(role)}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                ) : systemRoleNames.has(role.name) ? (
                  <span className="inline-flex h-8 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-2.5 text-xs font-bold text-[#667085]">
                    Rol base
                  </span>
                ) : null}
              </div>
            </div>
            <h3 className="mt-3 whitespace-normal break-words font-semibold leading-5 text-[#1f242d]">{role.name}</h3>
            <p className="mt-1 min-h-10 text-sm leading-5 text-[#667085]">
              {role.description ?? "Rol personalizado sin descripcion."}
            </p>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#e1e5eb] bg-white px-3 py-2">
              <span className="text-xs font-semibold text-[#667085]">Permisos activos</span>
              <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#4f46e5]">
                {role.permissions.length}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-[18px] border border-[#e1e5eb] bg-[#fbfcfd] p-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Matriz</p>
            <h3 className="mt-1 text-base font-semibold text-[#1f242d]">Permisos por modulo</h3>
          </div>
          <p className="text-sm text-[#667085]">Vista rapida para auditar quien puede ver o gestionar cada area.</p>
        </div>

      <DataTable className="mt-3" tableClassName="min-w-[980px]">
          <DataTableHead>
              <DataTableHeader>Modulo</DataTableHeader>
              {visibleRoles.map((role) => (
                <DataTableHeader key={role.id}>
                  {role.name}
                </DataTableHeader>
              ))}
          </DataTableHead>
          <tbody>
            {permissionGroups.map((group) => (
              <tr className="text-sm" key={group.module}>
                <DataTableCell className="font-semibold">{group.module}</DataTableCell>
                {visibleRoles.map((role) => (
                  <DataTableCell className="text-[#475467]" key={role.id}>
                    <PermissionSummary
                      labels={group.permissions
                        .filter((permission) => role.permissions.includes(permission.key))
                        .map((permission) => permission.label)}
                    />
                  </DataTableCell>
                ))}
              </tr>
            ))}
          </tbody>
      </DataTable>
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
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      {mode === "edit" ? "Editar rol" : "Nuevo rol"}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">
                      {mode === "edit" ? "Actualizar perfil de acceso" : "Crear perfil de acceso"}
                    </h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      Marca solo los permisos que este perfil debe utilizar.
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-[#667085]">Nombre del rol</span>
                      <input autoComplete="off"
                        className={inputClassName}
                        defaultValue={selectedRole?.name ?? ""}
                        name="name"
                        placeholder="Ej. Coordinador RRHH"
                        required
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-[#667085]">Descripcion</span>
                      <input autoComplete="off"
                        className={inputClassName}
                        defaultValue={selectedRole?.description ?? ""}
                        name="description"
                        placeholder="Responsabilidad del rol"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {permissionGroups.map((group) => (
                      <fieldset className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3" key={group.module}>
                        <legend className="px-1 text-sm font-semibold text-[#344054]">{group.module}</legend>
                        <div className="mt-2 grid gap-2">
                          {group.permissions.map((permission) => (
                            <label
                              className="flex items-center gap-3 rounded-xl border border-[#e1e5eb] bg-white px-3 py-2 text-sm text-[#475467] transition hover:border-[#4f46e5]"
                              key={permission.key}
                            >
                              <input autoComplete="off"
                                className="h-4 w-4 accent-[#4f46e5]"
                                defaultChecked={selectedRole?.permissions.includes(permission.key) ?? false}
                                name="permissions"
                                type="checkbox"
                                value={permission.key}
                              />
                              {permission.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085]">
                    <p className="flex items-center gap-2 font-semibold text-[#344054]">
                      <KeyRound className="h-4 w-4 text-[#4f46e5]" />
                      Aplicacion de cambios
                    </p>
                    <p className="mt-1">
                      Los permisos se guardan al instante. Si una persona ya tiene sesion abierta, al cambiar de pantalla el sistema volvera a validar sus accesos.
                    </p>
                  </div>

                  <div className="mt-5 border-t border-[#e1e5eb] pt-4">
                    <div className="min-h-9">
                      {state === "loading" ? <ActionFeedback message="Guardando rol..." tone="loading" /> : null}
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
                        Guardar rol
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isDeleteOpen && isMounted && selectedRole
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
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                        Confirmar eliminacion
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">
                        Eliminar rol {selectedRole.name}
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
                    Esta accion elimina un rol personalizado creado por error. No se permite eliminar roles base ni roles que tengan usuarios asignados.
                  </p>

                  <div className="mt-5 min-h-9">
                    {state === "loading" ? <ActionFeedback message="Eliminando rol..." tone="loading" /> : null}
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
                      onClick={handleDeleteRole}
                      type="button"
                    >
                      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Eliminar rol
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </CrudSection>
  );
}

function PermissionSummary({ labels }: { labels: string[] }) {
  if (labels.length === 0) {
    return <PermissionPill value="Sin acceso" tone="muted" />;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <PermissionPill key={label} value={label} tone="active" />
      ))}
    </div>
  );
}

function PermissionPill({ tone, value }: { tone: "active" | "muted"; value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        tone === "active" ? "bg-[#e0f2fe] text-[#0284c7]" : "bg-[#f2f4f7] text-[#667085]"
      }`}
    >
      {permissionLabels.get(value) ?? value}
    </span>
  );
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
