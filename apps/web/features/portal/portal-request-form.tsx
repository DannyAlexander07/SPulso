"use client";

import { CalendarDays, Loader2, Plus, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createPortalRequest, type CreatePortalRequestPayload } from "./api";

type RequestKind = CreatePortalRequestPayload["type"];

const requestOptions: Array<{
  description: string;
  title: string;
  type: RequestKind;
}> = [
  { type: "VACATION", title: "Vacaciones", description: "Descanso o feriado legal." },
  { type: "PERMISSION", title: "Permiso", description: "Salida, ausencia o permiso personal." },
  { type: "REMOTE_WORK", title: "Trabajo remoto", description: "Informa que trabajaras fuera de sede." },
  { type: "MEDICAL_LEAVE", title: "Descanso medico", description: "Registra licencia o descanso medico." },
  { type: "OTHER", title: "Otra solicitud", description: "Caso especial para RRHH." },
];

export function PortalRequestButton({ initialType }: { initialType?: RequestKind }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus className="h-4 w-4" />
        Nueva solicitud
      </button>
      {open ? <PortalRequestModal initialType={initialType} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function PortalQuickRequest({ description, title, type }: { description: string; title: string; type: RequestKind }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-left transition hover:border-[#818cf8] hover:bg-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs text-[#667085]">{description}</span>
        </span>
        <Send className="h-4 w-4 text-[#4f46e5]" />
      </button>
      {open ? <PortalRequestModal initialType={type} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PortalRequestModal({ initialType, onClose }: { initialType?: RequestKind; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<RequestKind>(initialType ?? "VACATION");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => requestOptions.find((option) => option.type === type) ?? requestOptions[0], [type]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMounted, isSubmitting, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") ?? "");
    const description = String(form.get("description") ?? "").trim();

    if (!startDate) {
      setMessage("Selecciona la fecha de inicio.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      await createPortalRequest({
        type,
        title: selected.title,
        description: description || undefined,
        startDate,
        endDate: endDate || startDate,
      });
      onClose();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100svh] items-center justify-center overflow-hidden bg-[#101828]/45 p-2 backdrop-blur-sm sm:p-4">
      <section className="flex max-h-[calc(100svh-1rem)] w-full max-w-2xl animate-rise flex-col overflow-hidden rounded-[24px] border border-[#dfe5ee] bg-white shadow-[0_30px_90px_rgba(16,24,40,0.25)] sm:max-h-[min(92svh,760px)] sm:rounded-[28px]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e1e5eb] px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Nueva solicitud</p>
            <h2 className="mt-1 text-xl font-semibold leading-6 sm:text-2xl">Enviar solicitud a RRHH</h2>
            <p className="mt-2 hidden text-sm leading-6 text-[#667085] sm:block">
              Completa los datos y quedara pendiente para revision del area responsable.
            </p>
          </div>
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfe5ee] text-[#475467] hover:bg-[#f8fafc]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form autoComplete="off" className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {requestOptions.map((option) => (
                <button
                  className={`rounded-2xl border p-3 text-left transition ${
                    type === option.type ? "border-[#4f46e5] bg-[#eef2ff]" : "border-[#e1e5eb] bg-[#fbfcfd] hover:border-[#818cf8]"
                  }`}
                  key={option.type}
                  onClick={() => setType(option.type)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#667085]">{option.description}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[#667085]">Desde</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                  <input autoComplete="off" className={inputClassName} name="startDate" required type="date" />
                </div>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[#667085]">Hasta</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                  <input autoComplete="off" className={inputClassName} name="endDate" type="date" />
                </div>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#667085]">Motivo</span>
              <textarea autoComplete="off"
                className="min-h-28 w-full resize-none rounded-2xl border border-[#d8dee8] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                name="description"
                placeholder="Describe brevemente el motivo de tu solicitud."
              />
            </label>

            <p className="min-h-5 text-sm text-[#b42318]">{message}</p>
          </div>

          <div className="shrink-0 border-t border-[#e1e5eb] bg-white px-4 py-3 sm:px-5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="h-11 rounded-xl border border-[#dfe5ee] px-4 text-sm font-semibold text-[#475467] hover:bg-[#f8fafc]" onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca] disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar solicitud
            </button>
            </div>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

const inputClassName =
  "h-11 w-full rounded-2xl border border-[#d8dee8] bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
