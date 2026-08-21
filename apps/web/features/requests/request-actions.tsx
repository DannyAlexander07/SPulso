"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Check, Loader2, MessageSquareText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { approveRequest, rejectRequest } from "./api";
import type { EmployeeRequest } from "./types";

type ActionState = "idle" | "approving" | "rejecting" | "approved" | "rejected" | "error";

export function RequestActions({ request }: { request: EmployeeRequest }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) {
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

  const isLoading = state === "approving" || state === "rejecting";

  function closeModal() {
    if (isLoading) {
      return;
    }

    setIsOpen(false);
    setState("idle");
    setMessage("");
  }

  async function handleDecision(decision: "approve" | "reject") {
    setState(decision === "approve" ? "approving" : "rejecting");
    setMessage("");

    try {
      if (decision === "approve") {
        await approveRequest(request.id);
        setState("approved");
        setMessage("Solicitud aprobada.");
      } else {
        await rejectRequest(request.id);
        setState("rejected");
        setMessage("Solicitud rechazada.");
      }

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
        className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        Revisar solicitud
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
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Decision pendiente
                    </p>
                    <h3 className="mt-1 whitespace-normal break-words text-xl font-semibold leading-6 text-[#1f242d]">{request.title}</h3>
                    <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-[#667085]">
                      {request.employee.firstName} {request.employee.lastName} · {request.company.name}
                    </p>
                  </div>
                  <button
                    aria-label="Cerrar"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
                    disabled={isLoading}
                    onClick={closeModal}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-[calc(100dvh-156px)] overflow-y-auto px-5 py-5">
                  <div className="grid gap-3 text-sm text-[#475467]">
                    <Info label="Tipo" value={typeLabel(request.type)} />
                    <Info label="Periodo" value={formatDateRange(request.startDate, request.endDate)} />
                    <Info label="Detalle" value={request.description ?? "Sin detalle"} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085]">
                    <p className="font-semibold text-[#344054]">Efecto al aprobar</p>
                    <p className="mt-1">
                      {affectsAttendance(request.type)
                        ? "SPulso marcara el periodo como permiso en asistencia."
                        : "Esta solicitud no modifica asistencia automaticamente."}
                    </p>
                  </div>

                  <label className="mt-4 block space-y-1.5">
                    <span className="text-xs font-semibold text-[#667085]">Nota interna</span>
                    <textarea autoComplete="off"
                      className="min-h-20 w-full resize-none rounded-xl border border-[#d8dee8] bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                      placeholder="Opcional por ahora. Luego lo guardaremos como comentario de decision."
                    />
                  </label>

                  <div className="mt-5 border-t border-[#e1e5eb] pt-4">
                    <div className="min-h-9">
                      {state === "approving" ? <ActionFeedback message="Aprobando y sincronizando..." tone="loading" /> : null}
                      {state === "rejecting" ? <ActionFeedback message="Rechazando solicitud..." tone="loading" /> : null}
                      {state === "approved" || state === "rejected" ? <ActionFeedback message={message} tone="success" /> : null}
                      {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
                    </div>

                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#98a2b3] disabled:opacity-60"
                        disabled={isLoading}
                        onClick={closeModal}
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#fee4e2] px-4 text-sm font-semibold text-[#b42318] transition hover:bg-[#fecdca] disabled:opacity-70"
                        disabled={isLoading || state === "approved" || state === "rejected"}
                        onClick={() => handleDecision("reject")}
                        type="button"
                      >
                        {state === "rejecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Rechazar
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0284c7] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(2,132,199,0.18)] transition hover:bg-[#0369a1] disabled:opacity-70"
                        disabled={isLoading || state === "approved" || state === "rejected"}
                        onClick={() => handleDecision("approve")}
                        type="button"
                      >
                        {state === "approving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Aprobar
                      </button>
                    </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fbfcfd] px-3 py-2">
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-0.5 font-medium text-[#344054]">{value}</p>
    </div>
  );
}

function affectsAttendance(type: EmployeeRequest["type"]) {
  return type === "VACATION" || type === "PERMISSION" || type === "MEDICAL_LEAVE";
}

function typeLabel(type: EmployeeRequest["type"]) {
  const labels = {
    VACATION: "Vacaciones",
    PERMISSION: "Permiso",
    REMOTE_WORK: "Trabajo remoto",
    MEDICAL_LEAVE: "Descanso medico",
    OTHER: "Otro",
  };

  return labels[type];
}

function formatDateRange(startDate: string, endDate: string | null) {
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : start;

  return start === end ? start : `${start} - ${end}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
