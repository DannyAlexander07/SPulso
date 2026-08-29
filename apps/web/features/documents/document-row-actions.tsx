"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import type { Employee } from "@/features/employees/types";
import { Check, Loader2, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deleteDocument, updateDocument, uploadDocumentFile } from "./api";
import { documentStatuses, documentTypes } from "./create-document-form";
import { DocumentFilePreview } from "./document-file-preview";
import { EmployeePicker } from "./employee-picker";
import type { EmployeeDocument } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function DocumentRowActions({
  document: employeeDocument,
  employees,
}: {
  document: EmployeeDocument;
  employees: Employee[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [uploadState, setUploadState] = useState<FormState>("idle");
  const [fileUrl, setFileUrl] = useState(employeeDocument.fileUrl ?? "");
  const [fileName, setFileName] = useState(employeeDocument.fileName ?? "");
  const [fileMeta, setFileMeta] = useState<{
    mimeType?: string | null;
    size?: number | null;
  }>({
    mimeType: employeeDocument.mimeType,
    size: employeeDocument.fileSize,
  });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([
    employeeDocument.employee.id,
  ]);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerEmployees = employees.some(
    (employee) => employee.id === employeeDocument.employee.id,
  )
    ? employees
    : [
        {
          id: employeeDocument.employee.id,
          firstName: employeeDocument.employee.firstName,
          lastName: employeeDocument.employee.lastName,
          documentNumber: null,
          personalEmail: null,
          phoneMobile: null,
          address: null,
          employeeCode: null,
          areaId: null,
          positionId: null,
          teamId: null,
          managerId: null,
          jobTitle: employeeDocument.employee.jobTitle,
          area: null,
          hireDate: null,
          terminatedAt: null,
          terminationReason: null,
          status: "ACTIVE" as const,
          company: employeeDocument.company,
          areaRef: null,
          position: null,
          team: null,
          manager: null,
          user: null,
        },
        ...employees,
      ];

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
    setFileUrl(employeeDocument.fileUrl ?? "");
    setFileName(employeeDocument.fileName ?? "");
    setFileMeta({
      mimeType: employeeDocument.mimeType,
      size: employeeDocument.fileSize,
    });
    setSelectedEmployeeIds([employeeDocument.employee.id]);
    setIsConfirmingDelete(false);
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
      setFileName(uploaded.fileName || file.name);
      setFileMeta({
        mimeType: uploaded.mimeType,
        size: uploaded.size,
      });
      setUploadState("success");
    } catch (error) {
      setUploadState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo subir el archivo.",
      );
    }
  }

  async function handleDelete() {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    setState("loading");
    setMessage("");

    try {
      await deleteDocument(employeeDocument.id);
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo eliminar.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    setState("loading");
    setMessage("");

    try {
      const employeeId = String(data.get("employeeId") ?? "");

      if (!employeeId) {
        throw new Error("Selecciona un trabajador.");
      }

      await updateDocument(employeeDocument.id, {
        employeeId,
        type: String(data.get("type") ?? "OTHER") as EmployeeDocument["type"],
        status: String(
          data.get("status") ?? "DRAFT",
        ) as EmployeeDocument["status"],
        title: String(data.get("title") ?? ""),
        folder: String(data.get("folder") ?? "") || null,
        fileUrl: fileUrl || null,
        fileName: fileUrl ? fileName || null : null,
        mimeType: fileUrl ? (fileMeta.mimeType ?? null) : null,
        fileSize: fileUrl ? (fileMeta.size ?? null) : null,
        issuedAt: String(data.get("issuedAt") ?? "") || null,
        expiresAt: String(data.get("expiresAt") ?? "") || null,
      });

      setState("success");
      setMessage("Documento actualizado.");
      router.refresh();
      closeModal();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo actualizar.",
      );
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
              <div className="animate-rise max-h-[calc(100dvh-48px)] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#e1e5eb] bg-white shadow-[0_28px_90px_rgba(16,24,40,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Ficha documental
                    </p>
                    <h3 className="mt-1 whitespace-normal break-words text-xl font-semibold leading-6 text-[#1f242d]">
                      {employeeDocument.title}
                    </h3>
                    <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-[#667085]">
                      {employeeDocument.employee.firstName}{" "}
                      {employeeDocument.employee.lastName} ·{" "}
                      {employeeDocument.company.name}
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

                <form
                  autoComplete="off"
                  className="max-h-[calc(100dvh-156px)] overflow-y-auto px-5 py-5"
                  onSubmit={handleSubmit}
                >
                  <div className="grid gap-4 lg:grid-cols-3">
                    <EmployeePicker
                      initialEmployees={pickerEmployees}
                      label="Trabajador"
                      name="employeeId"
                      onChange={setSelectedEmployeeIds}
                      placeholder="Seleccionar trabajador"
                      selectedIds={selectedEmployeeIds}
                    />
                    <Field label="Tipo">
                      <select
                        className={inputClassName}
                        defaultValue={employeeDocument.type}
                        name="type"
                        required
                      >
                        {documentTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Estado">
                      <select
                        className={inputClassName}
                        defaultValue={employeeDocument.status}
                        name="status"
                        required
                      >
                        {documentStatuses.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Titulo">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        defaultValue={employeeDocument.title}
                        name="title"
                        required
                      />
                    </Field>
                    <Field label="Carpeta">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        defaultValue={employeeDocument.folder}
                        name="folder"
                        required
                      />
                    </Field>
                    <Field label="Emision">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        defaultValue={
                          employeeDocument.issuedAt
                            ? employeeDocument.issuedAt.slice(0, 10)
                            : ""
                        }
                        name="issuedAt"
                        type="date"
                      />
                    </Field>
                    <Field label="Vencimiento">
                      <input
                        autoComplete="off"
                        className={inputClassName}
                        defaultValue={
                          employeeDocument.expiresAt
                            ? employeeDocument.expiresAt.slice(0, 10)
                            : ""
                        }
                        name="expiresAt"
                        type="date"
                      />
                    </Field>
                    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3 text-sm text-[#667085] lg:col-span-3">
                      <input
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                        type="file"
                      />
                      <p className="font-semibold text-[#344054]">
                        Archivo asociado
                      </p>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                          {fileName ||
                            (fileUrl
                              ? "Archivo cargado en SPulso."
                              : "Sin archivo adjunto.")}
                        </p>
                        <button
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-60"
                          disabled={uploadState === "loading"}
                          onClick={() => fileInputRef.current?.click()}
                          type="button"
                        >
                          {uploadState === "loading" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UploadCloud className="h-4 w-4" />
                          )}
                          {fileUrl ? "Reemplazar archivo" : "Subir archivo"}
                        </button>
                      </div>
                      {fileUrl ? (
                        <DocumentFilePreview
                          actionLabel="Abrir"
                          className="mt-3"
                          fallbackName={employeeDocument.title}
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
                      {state === "loading" ? (
                        <ActionFeedback
                          message="Guardando cambios..."
                          tone="loading"
                        />
                      ) : null}
                      {uploadState === "loading" ? (
                        <ActionFeedback
                          message="Subiendo archivo..."
                          tone="loading"
                        />
                      ) : null}
                      {uploadState === "success" ? (
                        <ActionFeedback
                          message="Archivo listo para guardar."
                          tone="success"
                        />
                      ) : null}
                      {state === "success" ? (
                        <ActionFeedback message={message} tone="success" />
                      ) : null}
                      {state === "error" ? (
                        <ActionFeedback message={message} tone="error" />
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#fecaca] bg-white px-4 text-sm font-semibold text-[#b42318] transition hover:bg-[#fef3f2] disabled:opacity-60"
                        disabled={state === "loading"}
                        onClick={handleDelete}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isConfirmingDelete
                          ? "Confirmar eliminacion"
                          : "Eliminar documento"}
                      </button>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[#d8dee8] bg-white px-3 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#c7d2fe]";
