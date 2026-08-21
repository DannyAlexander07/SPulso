"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { Archive, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { deleteDocumentFolder, updateDocumentFolder } from "./api";
import { documentTypes } from "./create-document-form";
import type { DocumentFolder, EmployeeDocument } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function DocumentFolderActions({ folder }: { folder: DocumentFolder }) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const documentCount = folder._count?.documents ?? 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function closeModal() {
    if (state === "loading") return;
    setIsOpen(false);
    setIsConfirmingDelete(false);
    setState("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    setState("loading");
    setMessage("");

    try {
      await updateDocumentFolder(folder.id, {
        name: String(data.get("name") ?? ""),
        description: String(data.get("description") ?? ""),
        type: (String(data.get("type") ?? "") || null) as EmployeeDocument["type"] | null,
        visibleToEmployee: data.get("visibleToEmployee") === "on",
        requiresSignature: data.get("requiresSignature") === "on",
        allowMultiple: data.get("allowMultiple") === "on",
        retentionYears: Number(data.get("retentionYears") ?? "") || null,
      });

      setState("success");
      setMessage("Carpeta actualizada.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la carpeta.");
    }
  }

  async function handleDeleteOrArchive() {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    setState("loading");
    setMessage("");

    try {
      if (documentCount > 0) {
        await updateDocumentFolder(folder.id, { status: "INACTIVE" });
      } else {
        await deleteDocumentFolder(folder.id);
      }

      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo procesar la carpeta.");
    }
  }

  return (
    <>
      <button
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#d8dee8] bg-white px-2.5 text-xs font-bold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
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
              <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Carpeta documental
                    </p>
                    <h3 className="mt-1 break-words text-xl font-semibold text-[#1f242d]">
                      {folder.name}
                    </h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      {documentCount} documento{documentCount === 1 ? "" : "s"} asociado{documentCount === 1 ? "" : "s"}.
                    </p>
                  </div>
                  <button
                    aria-label="Cerrar"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e1e5eb] text-[#667085] transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
                    onClick={closeModal}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form className="space-y-4 px-5 py-5" onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre">
                      <input className={inputClassName} defaultValue={folder.name} name="name" required />
                    </Field>
                    <Field label="Tipo sugerido">
                      <select className={inputClassName} defaultValue={folder.type ?? ""} name="type">
                        <option value="">Sin tipo fijo</option>
                        {documentTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Retencion">
                      <input
                        className={inputClassName}
                        defaultValue={folder.retentionYears ?? ""}
                        min="0"
                        name="retentionYears"
                        placeholder="Años, opcional"
                        type="number"
                      />
                    </Field>
                    <Field label="Descripcion">
                      <input
                        className={inputClassName}
                        defaultValue={folder.description ?? ""}
                        name="description"
                        placeholder="Uso de esta carpeta"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Toggle defaultChecked={folder.visibleToEmployee} label="Visible en portal" name="visibleToEmployee" />
                    <Toggle defaultChecked={folder.requiresSignature} label="Requiere firma" name="requiresSignature" />
                    <Toggle defaultChecked={folder.allowMultiple} label="Permite varios" name="allowMultiple" />
                  </div>

                  <div className="min-h-9">
                    {state === "loading" ? <ActionFeedback message="Procesando carpeta..." tone="loading" /> : null}
                    {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
                    {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#fecaca] bg-white px-4 text-sm font-semibold text-[#b42318] transition hover:bg-[#fef3f2] disabled:opacity-60"
                      disabled={state === "loading"}
                      onClick={handleDeleteOrArchive}
                      type="button"
                    >
                      {documentCount > 0 ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      {isConfirmingDelete
                        ? documentCount > 0
                          ? "Confirmar desactivacion"
                          : "Confirmar eliminacion"
                        : documentCount > 0
                          ? "Desactivar carpeta"
                          : "Eliminar carpeta"}
                    </button>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        className="h-10 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467]"
                        disabled={state === "loading"}
                        onClick={closeModal}
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white disabled:opacity-70"
                        disabled={state === "loading"}
                        type="submit"
                      >
                        {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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

function Toggle({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked?: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2 text-sm font-semibold text-[#475467]">
      {label}
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
