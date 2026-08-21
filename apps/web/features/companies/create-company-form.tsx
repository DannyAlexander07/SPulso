"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Building2, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createCompany } from "./api";

type FormState = "idle" | "loading" | "success" | "error";

export function CreateCompanyForm() {
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
      await createCompany({
        name: String(data.get("name") ?? ""),
        slug: String(data.get("slug") ?? ""),
        ruc: String(data.get("ruc") ?? ""),
      });

      form.reset();
      setState("success");
      setMessage("Empresa creada correctamente.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear la empresa.");
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
        Nueva empresa
      </button>

      {isOpen && isMounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm"
              role="dialog"
            >
              <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Nueva unidad
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">
                      Crear empresa del grupo
                    </h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      Registra la empresa para asociar trabajadores, documentos, asistencia y reglas propias.
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
                      <input autoComplete="off" className={inputClassName} name="name" placeholder="Ej. Nova Retail" required />
                    </Field>
                    <Field label="Identificador">
                      <input autoComplete="off" className={inputClassName} name="slug" placeholder="Ej. nova-retail" />
                    </Field>
                    <Field label="RUC">
                      <input autoComplete="off" className={inputClassName} name="ruc" placeholder="Opcional" />
                    </Field>
                    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085]">
                      <p className="flex items-center gap-2 font-semibold text-[#344054]">
                        <Building2 className="h-4 w-4 text-[#4f46e5]" />
                        Escalable
                      </p>
                      <p className="mt-1">
                        Luego podras asignarle trabajadores, usuarios, reglas de asistencia y documentos.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[#e1e5eb] pt-4">
                    <div className="min-h-9">
                      {state === "loading" ? <ActionFeedback message="Creando empresa..." tone="loading" /> : null}
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
                        Crear empresa
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
