"use client";

import type { Company } from "@/features/companies/types";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  PencilLine,
  RefreshCw,
  Upload,
  UserRoundCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  downloadEmployeeImportTemplate,
  getEmployeeImportBatch,
  getEmployeeImportBatches,
  retryEmployeeImport,
  skipEmployeeImportRow,
  updateEmployeeImportRow,
  uploadEmployeeImport,
} from "./api";
import type {
  EmployeeImportBatch,
  EmployeeImportError,
  EmployeeImportRow,
  EmployeeImportRowData,
} from "./types";

type BusyAction =
  "download" | "upload" | "load" | "save" | "retry" | "skip" | null;

const fieldLabels: Record<
  keyof EmployeeImportRowData | "attendancePin" | "row",
  string
> = {
  firstName: "Nombres",
  lastName: "Apellidos",
  documentNumber: "DNI / documento",
  personalEmail: "Correo personal",
  phoneMobile: "Celular",
  address: "Dirección",
  area: "Área",
  position: "Cargo",
  team: "Equipo",
  managerReference: "Jefe (DNI o correo)",
  hireDate: "Fecha de ingreso",
  employeeCode: "Código interno",
  attendancePin: "PIN de marcación",
  row: "Fila",
};

const editableFields = Object.keys(fieldLabels).filter(
  (field) => field !== "attendancePin" && field !== "row",
) as Array<keyof EmployeeImportRowData>;

export function EmployeeImportDialog({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<EmployeeImportBatch[]>([]);
  const [batch, setBatch] = useState<EmployeeImportBatch | null>(null);
  const [editingRow, setEditingRow] = useState<EmployeeImportRow | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    void loadBatches();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        if (editingRow) setEditingRow(null);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, editingRow, busy]);

  const unresolvedRows = useMemo(
    () =>
      batch?.rows?.filter(
        (row) => row.status === "PENDING" || row.status === "FAILED",
      ) ?? [],
    [batch],
  );

  async function loadBatches() {
    setBusy("load");
    setError("");
    try {
      setBatches(await getEmployeeImportBatches());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function openBatch(batchId: string) {
    setBusy("load");
    setError("");
    try {
      setBatch(await getEmployeeImportBatch(batchId));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId || !file) {
      setError("Selecciona la empresa y un archivo .xlsx.");
      return;
    }
    setBusy("upload");
    setError("");
    setMessage("");
    try {
      const result = await uploadEmployeeImport(companyId, file);
      setBatch(result);
      setFile(null);
      const input = document.getElementById(
        "employee-import-file",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage(importSummary(result));
      await loadBatches();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy("download");
    setError("");
    try {
      await downloadEmployeeImportTemplate();
      setMessage("Plantilla descargada. No cambies los encabezados.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handleRetry() {
    if (!batch) return;
    setBusy("retry");
    setError("");
    try {
      const result = await retryEmployeeImport(batch.id);
      setBatch(result);
      setMessage(importSummary(result));
      await loadBatches();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handleSkip(row: EmployeeImportRow) {
    if (!batch) return;
    setBusy("skip");
    setError("");
    try {
      const result = await skipEmployeeImportRow(batch.id, row.id);
      setBatch(result);
      setMessage(
        `La fila ${row.rowNumber} quedó omitida y registrada en el historial.`,
      );
      await loadBatches();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handleCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch || !editingRow) return;
    const data = new FormData(event.currentTarget);
    const corrected = Object.fromEntries(
      editableFields.map((field) => [
        field,
        String(data.get(field) ?? "").trim(),
      ]),
    ) as Partial<EmployeeImportRowData>;
    setBusy("save");
    setError("");
    try {
      const result = await updateEmployeeImportRow(
        batch.id,
        editingRow.id,
        editingRow.version,
        corrected,
        String(data.get("attendancePin") ?? ""),
      );
      setBatch(result);
      setEditingRow(null);
      setMessage(importSummary(result));
      await loadBatches();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cfd8e6] bg-white px-4 text-sm font-semibold text-[#344054] shadow-sm transition hover:border-[#4f46e5] hover:text-[#4f46e5]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Importar Excel
      </button>

      {open && mounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/45 p-2 backdrop-blur-sm sm:p-4"
              role="dialog"
            >
              <section className="flex max-h-[calc(100dvh-24px)] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-[#dbe3ee] bg-white shadow-[0_32px_100px_rgba(16,24,40,0.28)]">
                <header className="flex items-start justify-between gap-4 border-b border-[#e1e5eb] bg-[#f8fafc] px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4f46e5] text-white">
                      <Upload className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                        Carga masiva segura
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-[#1f242d]">
                        Importar trabajadores desde Excel
                      </h2>
                      <p className="mt-1 text-sm text-[#667085]">
                        Los correctos se registran de inmediato. Los incompletos
                        permanecen en la Bandeja de pendientes.
                      </p>
                    </div>
                  </div>
                  <button
                    aria-label="Cerrar"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#d8dee8] bg-white text-[#667085]"
                    disabled={Boolean(busy)}
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </header>

                <div className="overflow-y-auto bg-[#f8fafc] p-4 sm:p-5">
                  {error ? <Notice tone="error" text={error} /> : null}
                  {message ? <Notice tone="success" text={message} /> : null}

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.75fr)]">
                    <div className="space-y-4">
                      <form
                        className="rounded-2xl border border-[#dbe3ee] bg-white p-4"
                        onSubmit={handleUpload}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-[#1f242d]">
                              1. Prepara y carga el archivo
                            </h3>
                            <p className="mt-1 text-xs text-[#667085]">
                              Máximo 1,000 filas y 3 MB. Una empresa por
                              archivo.
                            </p>
                          </div>
                          <button
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#cfd8e6] px-3 text-sm font-semibold text-[#344054]"
                            disabled={Boolean(busy)}
                            onClick={handleDownload}
                            type="button"
                          >
                            {busy === "download" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}{" "}
                            Descargar plantilla
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <label className="text-sm font-semibold text-[#344054]">
                            Empresa
                            <select
                              className="mt-1 h-11 w-full rounded-xl border border-[#cfd8e6] bg-white px-3 font-normal"
                              onChange={(event) =>
                                setCompanyId(event.target.value)
                              }
                              required
                              value={companyId}
                            >
                              <option value="">Selecciona una empresa</option>
                              {companies
                                .filter(
                                  (company) => company.status === "ACTIVE",
                                )
                                .map((company) => (
                                  <option key={company.id} value={company.id}>
                                    {company.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="text-sm font-semibold text-[#344054]">
                            Archivo Excel
                            <input
                              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                              className="mt-1 block h-11 w-full rounded-xl border border-[#cfd8e6] bg-white px-3 py-2 text-sm font-normal"
                              id="employee-import-file"
                              onChange={(event) =>
                                setFile(event.target.files?.[0] ?? null)
                              }
                              required
                              type="file"
                            />
                          </label>
                        </div>
                        <button
                          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white disabled:opacity-60"
                          disabled={Boolean(busy) || !file || !companyId}
                          type="submit"
                        >
                          {busy === "upload" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}{" "}
                          Validar e importar
                        </button>
                      </form>

                      {batch ? (
                        <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                                Bandeja de pendientes
                              </p>
                              <h3 className="mt-1 font-semibold text-[#1f242d]">
                                {batch.originalFileName}
                              </h3>
                              <p className="text-xs text-[#667085]">
                                {batch.company.name} · guardado{" "}
                                {formatDate(batch.createdAt)}
                              </p>
                            </div>
                            {unresolvedRows.length ? (
                              <button
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#cfd8e6] px-3 text-sm font-semibold"
                                disabled={Boolean(busy)}
                                onClick={handleRetry}
                                type="button"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${busy === "retry" ? "animate-spin" : ""}`}
                                />{" "}
                                Reintentar pendientes
                              </button>
                            ) : null}
                          </div>
                          <BatchMetrics batch={batch} />
                          {unresolvedRows.length ? (
                            <div className="mt-4 space-y-3">
                              {unresolvedRows.map((row) => (
                                <PendingRow
                                  busy={Boolean(busy)}
                                  key={row.id}
                                  onEdit={() => setEditingRow(row)}
                                  onSkip={() => void handleSkip(row)}
                                  row={row}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#ecfdf3] p-3 text-sm font-semibold text-[#027a48]">
                              <CheckCircle2 className="h-4 w-4" /> No quedan
                              trabajadores por corregir.
                            </div>
                          )}
                        </section>
                      ) : null}
                    </div>

                    <aside className="rounded-2xl border border-[#dbe3ee] bg-white p-4">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-[#4f46e5]" />
                        <h3 className="font-semibold text-[#1f242d]">
                          Historial de cargas
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-[#667085]">
                        Puedes apagar el equipo: los lotes y sus pendientes
                        quedan guardados en el servidor.
                      </p>
                      <div className="mt-4 space-y-2">
                        {busy === "load" && !batches.length ? (
                          <p className="text-sm text-[#667085]">Cargando…</p>
                        ) : null}
                        {batches.map((item) => (
                          <button
                            className={`w-full rounded-xl border p-3 text-left transition ${batch?.id === item.id ? "border-[#818cf8] bg-[#eef2ff]" : "border-[#e1e5eb] hover:border-[#a5b4fc]"}`}
                            key={item.id}
                            onClick={() => void openBatch(item.id)}
                            type="button"
                          >
                            <span className="block truncate text-sm font-semibold text-[#1f242d]">
                              {item.originalFileName}
                            </span>
                            <span className="mt-1 block text-xs text-[#667085]">
                              {item.company.name} · {item.importedRows}/
                              {item.totalRows} importados
                            </span>
                            {item.pendingRows + item.failedRows > 0 ? (
                              <span className="mt-2 inline-flex rounded-full bg-[#fff4e5] px-2 py-1 text-[11px] font-semibold text-[#b54708]">
                                {item.pendingRows + item.failedRows} por
                                corregir
                              </span>
                            ) : (
                              <span className="mt-2 inline-flex rounded-full bg-[#ecfdf3] px-2 py-1 text-[11px] font-semibold text-[#027a48]">
                                Completado
                              </span>
                            )}
                          </button>
                        ))}
                        {!busy && !batches.length ? (
                          <p className="rounded-xl border border-dashed border-[#d0d5dd] p-4 text-center text-sm text-[#667085]">
                            Aún no hay cargas.
                          </p>
                        ) : null}
                      </div>
                    </aside>
                  </div>
                </div>
              </section>

              {editingRow ? (
                <CorrectionModal
                  busy={busy === "save"}
                  onClose={() => setEditingRow(null)}
                  onSubmit={handleCorrection}
                  row={editingRow}
                />
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function BatchMetrics({ batch }: { batch: EmployeeImportBatch }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="Importados" tone="success" value={batch.importedRows} />
      <Metric label="Pendientes" tone="warning" value={batch.pendingRows} />
      <Metric label="Con error" tone="danger" value={batch.failedRows} />
      <Metric label="Omitidos" tone="neutral" value={batch.skippedRows} />
    </div>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  value: number;
}) {
  const colors = {
    success: "bg-[#ecfdf3] text-[#027a48]",
    warning: "bg-[#fff4e5] text-[#b54708]",
    danger: "bg-[#fef3f2] text-[#b42318]",
    neutral: "bg-[#f2f4f7] text-[#475467]",
  }[tone];
  return (
    <div className={`rounded-xl p-3 ${colors}`}>
      <strong className="block text-xl">{value}</strong>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

function PendingRow({
  busy,
  onEdit,
  onSkip,
  row,
}: {
  busy: boolean;
  onEdit: () => void;
  onSkip: () => void;
  row: EmployeeImportRow;
}) {
  const raw = isRedacted(row.rawData) ? null : row.rawData;
  return (
    <article className="rounded-xl border border-[#f4c7c3] bg-[#fffafa] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1f242d]">
            Fila {row.rowNumber}:{" "}
            {raw
              ? `${raw.firstName} ${raw.lastName}`.trim() || "Sin nombre"
              : "Datos protegidos"}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[#b42318]">
            {row.errors.map((item, index) => (
              <li key={`${item.field}-${item.code}-${index}`}>
                • <strong>{fieldLabels[item.field] ?? item.field}:</strong>{" "}
                {item.message}
                {item.conflict ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      className="underline"
                      href={`/trabajadores/${item.conflict.employeeId}`}
                    >
                      Ver ficha existente
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#4f46e5] px-3 text-xs font-semibold text-white"
            disabled={busy}
            onClick={onEdit}
            type="button"
          >
            <PencilLine className="h-3.5 w-3.5" /> Corregir
          </button>
          <button
            className="h-9 rounded-lg border border-[#d0d5dd] px-3 text-xs font-semibold text-[#475467]"
            disabled={busy}
            onClick={onSkip}
            type="button"
          >
            Omitir
          </button>
        </div>
      </div>
    </article>
  );
}

function CorrectionModal({
  busy,
  onClose,
  onSubmit,
  row,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  row: EmployeeImportRow;
}) {
  const raw = isRedacted(row.rawData) ? emptyRow() : row.rawData;
  const errorFields = new Set(row.errors.map((item) => item.field));
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-[#111827]/50 p-3"
      role="dialog"
      aria-modal="true"
    >
      <form
        className="flex max-h-[calc(100dvh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onSubmit={onSubmit}
      >
        <header className="flex items-start justify-between border-b border-[#e1e5eb] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#b54708]">
              Corrección requerida · fila {row.rowNumber}
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              Completa la ficha antes de importar
            </h3>
          </div>
          <button
            aria-label="Cerrar corrección"
            className="h-9 w-9 rounded-xl border border-[#d0d5dd]"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X className="mx-auto h-4 w-4" />
          </button>
        </header>
        <div className="overflow-y-auto p-4">
          <div className="mb-4 rounded-xl bg-[#fff4e5] p-3 text-xs text-[#934b00]">
            <strong>Qué debes corregir:</strong>
            <ul className="mt-1 space-y-1">
              {row.errors.map((item, index) => (
                <li key={`${item.field}-${index}`}>
                  • {fieldLabels[item.field]}: {item.message}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {editableFields.map((field) => (
              <label
                className="text-sm font-semibold text-[#344054]"
                key={field}
              >
                {fieldLabels[field]}
                {requiredField(field) ? " *" : ""}
                <input
                  className={`mt-1 h-10 w-full rounded-xl border px-3 font-normal outline-none ${errorFields.has(field) ? "border-[#f04438] bg-[#fffafa]" : "border-[#cfd8e6]"}`}
                  defaultValue={raw[field]}
                  name={field}
                  required={requiredField(field)}
                  type={
                    field === "hireDate"
                      ? "date"
                      : field === "personalEmail"
                        ? "email"
                        : "text"
                  }
                />
              </label>
            ))}
            <label className="text-sm font-semibold text-[#344054]">
              PIN de marcación *
              <input
                autoComplete="new-password"
                className={`mt-1 h-10 w-full rounded-xl border px-3 font-normal ${errorFields.has("attendancePin") ? "border-[#f04438] bg-[#fffafa]" : "border-[#cfd8e6]"}`}
                inputMode="numeric"
                maxLength={12}
                minLength={4}
                name="attendancePin"
                required
                type="password"
              />
            </label>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#e1e5eb] bg-[#f8fafc] p-4">
          <button
            className="h-10 rounded-xl border border-[#d0d5dd] px-4 text-sm font-semibold"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white"
            disabled={busy}
            type="submit"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserRoundCheck className="h-4 w-4" />
            )}{" "}
            Guardar e importar
          </button>
        </footer>
      </form>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold ${tone === "success" ? "border-[#abefc6] bg-[#ecfdf3] text-[#027a48]" : "border-[#fecdca] bg-[#fef3f2] text-[#b42318]"}`}
    >
      {tone === "success" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {text}
    </div>
  );
}

function isRedacted(
  data: EmployeeImportRow["rawData"],
): data is { redacted: true } {
  return "redacted" in data;
}
function requiredField(field: keyof EmployeeImportRowData) {
  return [
    "firstName",
    "lastName",
    "documentNumber",
    "area",
    "position",
  ].includes(field);
}
function emptyRow(): EmployeeImportRowData {
  return {
    firstName: "",
    lastName: "",
    documentNumber: "",
    personalEmail: "",
    phoneMobile: "",
    address: "",
    area: "",
    position: "",
    team: "",
    managerReference: "",
    hireDate: "",
    employeeCode: "",
  };
}
function importSummary(batch: EmployeeImportBatch) {
  const pending = batch.pendingRows + batch.failedRows;
  return `${batch.importedRows} trabajador(es) importado(s). ${pending ? `${pending} quedaron en la Bandeja de pendientes para corregir.` : "El lote quedó completo."}${batch.duplicateUpload ? " Este archivo ya había sido cargado; se abrió el lote guardado." : ""}`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado.";
}
