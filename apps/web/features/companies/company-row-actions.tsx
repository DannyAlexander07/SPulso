"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Check, Clock3, Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { updateCompany } from "./api";
import type { Company } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function CompanyRowActions({ company }: { company: Company }) {
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

    const data = new FormData(event.currentTarget);

    setState("loading");
    setMessage("");

    try {
      await updateCompany(company.id, {
        name: String(data.get("name") ?? ""),
        slug: String(data.get("slug") ?? ""),
        ruc: String(data.get("ruc") ?? "") || null,
        workStartTime: String(data.get("workStartTime") ?? ""),
        lateToleranceMinutes: Number(data.get("lateToleranceMinutes") ?? 0),
        status: String(data.get("status") ?? "ACTIVE") as Company["status"],
      });

      setState("success");
      setMessage("Empresa actualizada.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  return (
    <>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
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
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Ficha de empresa
                    </p>
                    <h3 className="mt-1 whitespace-normal break-words text-xl font-semibold leading-6 text-[#1f242d]">{company.name}</h3>
                    <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-[#667085]">
                      {company.slug} · RUC {company.ruc ?? "pendiente"}
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre">
                      <input autoComplete="off" className={inputClassName} defaultValue={company.name} name="name" required />
                    </Field>
                    <Field label="Identificador">
                      <input autoComplete="off" className={inputClassName} defaultValue={company.slug} name="slug" required />
                    </Field>
                    <Field label="RUC">
                      <input autoComplete="off" className={inputClassName} defaultValue={company.ruc ?? ""} name="ruc" />
                    </Field>
                    <Field label="Estado">
                      <select className={inputClassName} defaultValue={company.status} name="status">
                        <option value="ACTIVE">Activa</option>
                        <option value="INACTIVE">Inactiva</option>
                      </select>
                    </Field>
                  </div>

                  <section className="mt-5 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#344054]">
                      <Clock3 className="h-4 w-4 text-[#4f46e5]" />
                      Reglas de asistencia
                    </p>
                    <p className="mt-1 text-sm text-[#667085]">
                      Aplica a nuevas marcaciones. Los registros anteriores se mantienen como fueron guardados.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="Hora de entrada">
                        <input autoComplete="off"
                          className={inputClassName}
                          defaultValue={company.workStartTime}
                          name="workStartTime"
                          required
                          type="time"
                        />
                      </Field>
                      <Field label="Tolerancia en minutos">
                        <input autoComplete="off"
                          className={inputClassName}
                          defaultValue={company.lateToleranceMinutes}
                          max={180}
                          min={0}
                          name="lateToleranceMinutes"
                          required
                          type="number"
                        />
                      </Field>
                    </div>
                  </section>

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
