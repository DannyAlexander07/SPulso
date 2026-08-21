"use client";

import { AlertCircle, Check, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { lookupIdentityDocument, type IdentityLookupResult } from "./api";

export function IdentityLookupButton({
  documentInputId,
  onFound,
}: {
  documentInputId: string;
  onFound: (result: IdentityLookupResult) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleLookup() {
    const input = document.getElementById(documentInputId) as HTMLInputElement | null;
    const documentNumber = input?.value.trim() ?? "";

    if (!documentNumber) {
      setState("error");
      setMessage("Ingresa un DNI o RUC.");
      return;
    }

    setState("loading");
    setMessage("");
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    try {
      const result = await lookupIdentityDocument(documentNumber);
      onFound(result);
      setState("success");
      setMessage(result.tipo === "DNI" ? "DNI importado" : "RUC importado");
      resetTimerRef.current = window.setTimeout(() => {
        setState("idle");
        setMessage("");
        resetTimerRef.current = null;
      }, 1800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo consultar.");
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        aria-label="Consultar documento"
        aria-live="polite"
        className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-white shadow-sm transition disabled:opacity-60 ${
          state === "success"
            ? "border-[#12b76a] bg-[#ecfdf3] text-[#027a48]"
            : state === "error"
              ? "border-[#fecdca] bg-[#fff5f4] text-[#b42318]"
              : "border-[#d8dee8] text-[#475467] hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
        }`}
        disabled={state === "loading"}
        onClick={handleLookup}
        title={message || "Consultar DNI/RUC"}
        type="button"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "success" ? (
          <Check className="h-4 w-4" />
        ) : state === "error" ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </button>
      {message && state === "error" ? (
        <p className="absolute left-0 top-[calc(100%+8px)] z-20 w-64 rounded-2xl border border-[#fecdca] bg-white px-3 py-2 text-[11px] font-semibold leading-4 text-[#b42318] shadow-xl shadow-[#d92d20]/10">
          {message}
        </p>
      ) : null}
    </div>
  );
}
