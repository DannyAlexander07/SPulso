"use client";

import { Check, Download, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "@/lib/api";
import { signPortalDocument } from "./api";

export function PortalDocumentActions({
  fileUrl,
  id,
  status,
}: {
  fileUrl: string | null;
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [isSigning, setIsSigning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [signatureText, setSignatureText] = useState("");
  const [message, setMessage] = useState("");

  async function handleSign() {
    if (signatureText.trim().length < 4) {
      setMessage("Digita tu nombre para firmar.");
      return;
    }

    setIsSigning(true);
    setMessage("");

    try {
      await signPortalDocument(id, signatureText.trim());
      router.refresh();
      setIsOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo firmar.");
    } finally {
      setIsSigning(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {message ? <span className="hidden max-w-40 truncate text-xs text-[#b42318] sm:inline">{message}</span> : null}
      {status === "PENDING_SIGNATURE" ? (
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-3 text-xs font-bold text-white transition hover:bg-[#4338ca] disabled:opacity-60"
          disabled={isSigning}
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <Check className="h-4 w-4" />
          Firmar
        </button>
      ) : null}
      {fileUrl ? (
        <a
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe5ee] bg-white text-[#4f46e5]"
          href={mediaUrl(fileUrl)}
          rel="noreferrer"
          target="_blank"
          title="Descargar documento"
        >
          <Download className="h-4 w-4" />
        </a>
      ) : (
        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe5ee] bg-white text-[#98a2b3]"
          disabled
          title="Documento sin archivo adjunto"
          type="button"
        >
          <Download className="h-4 w-4" />
        </button>
      )}
      {isOpen
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111827]/45 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[#e1e5eb] bg-white p-5 shadow-[0_24px_70px_rgba(16,24,40,0.24)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Firma de documento</p>
                    <h3 className="mt-1 text-lg font-semibold text-[#1f242d]">Confirma tu firma</h3>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">
                      Digita tu nombre o conformidad. SPulso guardara la fecha, usuario y texto firmado.
                    </p>
                  </div>
                  <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085]" onClick={() => setIsOpen(false)} type="button">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  autoComplete="off"
                  className="mt-4 h-11 w-full rounded-xl border border-[#d8dee8] px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]"
                  maxLength={120}
                  onChange={(event) => setSignatureText(event.target.value)}
                  placeholder="Ej. Pedro Arellano - conforme"
                  value={signatureText}
                />
                {message ? <p className="mt-3 text-sm font-semibold text-[#b42318]">{message}</p> : null}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button className="h-10 rounded-xl border border-[#d8dee8] px-4 text-sm font-semibold text-[#475467]" disabled={isSigning} onClick={() => setIsOpen(false)} type="button">
                    Cancelar
                  </button>
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isSigning} onClick={handleSign} type="button">
                    {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Firmar documento
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
