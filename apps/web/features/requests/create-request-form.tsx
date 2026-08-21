"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { Employee } from "@/features/employees/types";
import { CalendarPlus, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRequest } from "./api";
import type { EmployeeRequest } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export const requestTypes: Array<{ label: string; value: EmployeeRequest["type"] }> = [
  { label: "Vacaciones", value: "VACATION" },
  { label: "Permiso", value: "PERMISSION" },
  { label: "Trabajo remoto", value: "REMOTE_WORK" },
  { label: "Descanso medico", value: "MEDICAL_LEAVE" },
  { label: "Otro", value: "OTHER" },
];

export function CreateRequestForm({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

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

  function closeModal() {
    if (state === "loading") {
      return;
    }

    setIsOpen(false);
    setState("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setState("loading");
    setMessage("");

    try {
      await createRequest({
        employeeId: String(data.get("employeeId") ?? ""),
        type: String(data.get("type") ?? "OTHER") as EmployeeRequest["type"],
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        startDate: String(data.get("startDate") ?? ""),
        endDate: String(data.get("endDate") ?? ""),
      });

      form.reset();
      setState("success");
      setMessage("Solicitud creada correctamente.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear la solicitud.");
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
        Nueva solicitud
      </button>

      {isOpen && isMounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
              role="dialog"
            >
              <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Flujo de aprobacion
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">Nueva solicitud</h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      Registra vacaciones, permisos, remoto o descanso medico para revision.
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
                  <div className="grid gap-4 lg:grid-cols-3">
                    <Field label="Trabajador">
                      <select className={inputClassName} name="employeeId" required>
                        <option value="">Seleccionar trabajador</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName} · {employee.company.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tipo">
                      <select className={inputClassName} name="type" required>
                        {requestTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Titulo">
                      <input autoComplete="off" className={inputClassName} name="title" placeholder="Ej. Vacaciones" required />
                    </Field>
                    <Field label="Inicio">
                      <input autoComplete="off" className={inputClassName} name="startDate" required type="date" />
                    </Field>
                    <Field label="Fin">
                      <input autoComplete="off" className={inputClassName} name="endDate" type="date" />
                    </Field>
                    <Field label="Descripcion">
                      <input autoComplete="off" className={inputClassName} name="description" placeholder="Detalle opcional" />
                    </Field>

                    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085] lg:col-span-3">
                      <p className="flex items-center gap-2 font-semibold text-[#344054]">
                        <Sparkles className="h-4 w-4 text-[#4f46e5]" />
                        Automatizacion de asistencia
                      </p>
                      <p className="mt-1">
                        Si se aprueban vacaciones, permisos o descanso medico, SPulso actualiza la asistencia del periodo.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[#e1e5eb] pt-4">
                    <div className="min-h-9">
                      {state === "loading" ? <ActionFeedback message="Creando solicitud..." tone="loading" /> : null}
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
                          <CalendarPlus className="h-4 w-4" />
                        )}
                        Crear solicitud
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
