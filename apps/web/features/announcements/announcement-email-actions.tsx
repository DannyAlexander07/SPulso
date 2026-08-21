"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Check, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendAnnouncementEmails } from "./api";

export function AnnouncementEmailSendButton({
  announcementId,
  disabled,
  pending,
}: {
  announcementId: string;
  disabled: boolean;
  pending: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSend() {
    setState("loading");
    setMessage("");

    try {
      const result = await sendAnnouncementEmails(announcementId);
      setState("success");
      setMessage(`Simulacion completada: ${result.processed} correos procesados.`);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo procesar la cola.");
    }
  }

  return (
    <div className="mt-4">
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)] transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || state === "loading"}
        onClick={handleSend}
        type="button"
      >
        {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : pending > 0 ? <Send className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {pending > 0 ? `Simular envio (${pending})` : "Sin pendientes"}
      </button>
      <div className="mt-2 min-h-8">
        {state === "loading" ? <ActionFeedback message="Procesando cola en modo simulacion..." tone="loading" /> : null}
        {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
        {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
      </div>
    </div>
  );
}
