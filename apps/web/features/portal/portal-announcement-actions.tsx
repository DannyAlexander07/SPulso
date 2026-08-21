"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markPortalAnnouncementAsRead } from "./api";

export function PortalAnnouncementReadButton({ id, readAt }: { id: string; readAt: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(readAt ? "success" : "idle");
  const [message, setMessage] = useState(readAt ? "Lectura confirmada" : "");

  async function handleClick() {
    if (readAt || state === "loading") return;
    setState("loading");
    setMessage("");

    try {
      await markPortalAnnouncementAsRead(id);
      setState("success");
      setMessage("Lectura confirmada");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar lectura.");
    }
  }

  return (
    <div className="mt-4">
      {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
      {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
      {!readAt ? (
        <button
          className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(79,70,229,0.18)] transition hover:bg-[#4338ca] disabled:opacity-70"
          disabled={state === "loading"}
          onClick={handleClick}
          type="button"
        >
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Marcar como leido
        </button>
      ) : null}
    </div>
  );
}
