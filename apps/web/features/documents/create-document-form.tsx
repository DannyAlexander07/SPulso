"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { Employee } from "@/features/employees/types";
import {
  FilePlus2,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createDocument, uploadDocumentFile } from "./api";
import { DocumentFilePreview } from "./document-file-preview";
import { EmployeePicker } from "./employee-picker";
import type { DocumentFolder, EmployeeDocument } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export const documentTypes: Array<{ label: string; value: EmployeeDocument["type"] }> = [
  { label: "Contrato", value: "CONTRACT" },
  { label: "Boleta", value: "PAYSLIP" },
  { label: "Politica", value: "POLICY" },
  { label: "Certificado", value: "CERTIFICATE" },
  { label: "Otro", value: "OTHER" },
];

export const documentStatuses: Array<{ label: string; value: EmployeeDocument["status"] }> = [
  { label: "Borrador", value: "DRAFT" },
  { label: "Pendiente de firma", value: "PENDING_SIGNATURE" },
  { label: "Vencido", value: "EXPIRED" },
];

export function CreateDocumentForm({
  employees,
  folders,
  initialEmployeeIds = [],
  initialFolderId = "",
  pinnedEmployees = [],
  triggerLabel = "Nuevo documento",
  variant = "primary",
}: {
  employees: Employee[];
  folders: DocumentFolder[];
  initialEmployeeIds?: string[];
  initialFolderId?: string;
  pinnedEmployees?: Employee[];
  triggerLabel?: string;
  variant?: "primary" | "compact";
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [uploadState, setUploadState] = useState<FormState>("idle");
  const [fileUrl, setFileUrl] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    initialEmployeeIds,
  );
  const [fileMeta, setFileMeta] = useState<{
    fileName?: string;
    mimeType?: string;
    size?: number;
  }>({});
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setUploadState("idle");
    setFileUrl("");
    setFileMeta({});
    setFileName("");
    setSelectedEmployeeIds(initialEmployeeIds);
  }

  function openModal() {
    setSelectedEmployeeIds(initialEmployeeIds);
    setIsOpen(true);
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadState("loading");
    setMessage("");

    try {
      const uploaded = await uploadDocumentFile(file);
      setFileUrl(uploaded.url);
      setFileMeta(uploaded);
      setFileName(uploaded.fileName || file.name);
      setUploadState("success");
    } catch (error) {
      setUploadState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo subir el archivo.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setState("loading");
    setMessage("");

    try {
      const employeeIds = data
        .getAll("employeeIds")
        .map((value) => String(value))
        .filter(Boolean);

      if (employeeIds.length === 0) {
        throw new Error("Selecciona al menos un trabajador.");
      }

      const selectedFolder = folders.find(
        (folder) => folder.id === String(data.get("folderId") ?? ""),
      );
      const requiresSignature =
        data.get("requiresSignature") === "on" || Boolean(selectedFolder?.requiresSignature);
      const visibleToEmployee =
        data.get("visibleToEmployee") === "on" || Boolean(selectedFolder?.visibleToEmployee);
      const selectedStatus = String(data.get("status") ?? "DRAFT") as EmployeeDocument["status"];
      const status =
        requiresSignature && selectedStatus === "DRAFT" ? "PENDING_SIGNATURE" : selectedStatus;

      await createDocument({
        employeeIds,
        folderId: String(data.get("folderId") ?? "") || undefined,
        type: String(data.get("type") ?? "OTHER") as EmployeeDocument["type"],
        status,
        title: String(data.get("title") ?? ""),
        folder: selectedFolder?.name ?? String(data.get("folder") ?? ""),
        fileUrl,
        fileName: fileMeta.fileName ?? fileName,
        mimeType: fileMeta.mimeType,
        fileSize: fileMeta.size,
        visibleToEmployee,
        requiresSignature,
        notes: String(data.get("notes") ?? ""),
        issuedAt: String(data.get("issuedAt") ?? ""),
        expiresAt: String(data.get("expiresAt") ?? ""),
      });

      form.reset();
      setSelectedEmployeeIds([]);
      setState("success");
      setMessage("Documento creado correctamente.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear el documento.");
    }
  }

  return (
    <>
      <button
        className={
          variant === "compact"
            ? "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#c7d2fe] bg-white px-3 text-xs font-bold text-[#4f46e5] transition hover:border-[#4f46e5] hover:bg-[#eef2ff]"
            : "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition hover:bg-[#4338ca]"
        }
        onClick={openModal}
        type="button"
      >
        <Plus className="h-4 w-4" />
        {triggerLabel}
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
                      Registro documental
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-[#1f242d]">
                      Nuevo documento laboral
                    </h3>
                    <p className="mt-1 text-sm text-[#667085]">
                      Registra el documento, responsable, estado y vencimiento.
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
                    <div className="space-y-1.5">
                      <EmployeePicker
                        initialEmployees={mergeEmployees(pinnedEmployees, employees)}
                        multiple
                        name="employeeIds"
                        onChange={setSelectedEmployeeIds}
                        selectedIds={selectedEmployeeIds}
                      />
                      <span className="text-[11px] font-semibold text-[#667085]">
                        Puedes elegir uno o varios trabajadores.
                      </span>
                    </div>
                    <Field label="Tipo">
                      <select className={inputClassName} name="type" required>
                        {documentTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Estado">
                      <select className={inputClassName} name="status" required>
                        {documentStatuses.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Titulo">
                      <input autoComplete="off" className={inputClassName} name="title" placeholder="Ej. Contrato laboral" required />
                    </Field>
                    <Field label="Carpeta">
                      <select className={inputClassName} defaultValue={initialFolderId} name="folderId" required>
                        <option value="">Seleccionar carpeta</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Emision">
                      <input autoComplete="off" className={inputClassName} name="issuedAt" type="date" />
                    </Field>
                    <Field label="Vencimiento">
                      <input autoComplete="off" className={inputClassName} name="expiresAt" type="date" />
                    </Field>
                    <div className="grid gap-3 rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 lg:col-span-3 sm:grid-cols-2">
                      <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#475467]">
                        Visible en portal trabajador
                        <input defaultChecked name="visibleToEmployee" type="checkbox" />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#475467]">
                        Requiere firma digital
                        <input name="requiresSignature" type="checkbox" />
                      </label>
                    </div>
                    <Field label="Nota interna">
                      <textarea className={`${inputClassName} h-24 py-3`} name="notes" placeholder="Detalle opcional para RRHH" />
                    </Field>
                    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085] lg:col-span-3">
                      <input accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileUpload} ref={fileInputRef} type="file" />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[#344054]">Archivo del documento</p>
                          <p className="mt-1">{fileName || "PDF, Word o imagen desde tu computadora. Maximo 25 MB."}</p>
                        </div>
                        <button
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
                          disabled={uploadState === "loading"}
                          onClick={() => fileInputRef.current?.click()}
                          type="button"
                        >
                          {uploadState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                          {fileUrl ? "Reemplazar archivo" : "Subir archivo"}
                        </button>
                      </div>
                      {fileUrl ? (
                        <DocumentFilePreview
                          actionLabel="Abrir"
                          className="mt-3"
                          fallbackName="Documento"
                          fileName={fileName}
                          fileSize={fileMeta.size}
                          fileUrl={fileUrl}
                          mimeType={fileMeta.mimeType ?? null}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[#e1e5eb] pt-4">
                    <div className="min-h-9">
                      {state === "loading" ? <ActionFeedback message="Creando documento..." tone="loading" /> : null}
                      {uploadState === "loading" ? <ActionFeedback message="Subiendo archivo..." tone="loading" /> : null}
                      {uploadState === "success" ? <ActionFeedback message="Archivo listo para guardar." tone="success" /> : null}
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
                          <FilePlus2 className="h-4 w-4" />
                        )}
                        Crear documento
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
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </div>
  );
}

function mergeEmployees(primary: Employee[], secondary: Employee[]) {
  const items = new Map<string, Employee>();

  for (const employee of [...primary, ...secondary]) {
    items.set(employee.id, employee);
  }

  return Array.from(items.values());
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
