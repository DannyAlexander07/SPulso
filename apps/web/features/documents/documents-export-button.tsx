"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { BackgroundExportButton } from "@/features/export-jobs/background-export-button";
import { clientAuthHeaders } from "@/lib/api";
import { escapeCsvValue } from "@/lib/csv";
import { IMMEDIATE_EXPORT_ROW_LIMIT } from "@/lib/export-limits";
import { Archive, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { documentZipExportUrl, getDocumentsForExport } from "./api";
import type { DocumentFilters, EmployeeDocument } from "./types";

type ExportState = "idle" | "loading" | "success" | "error";

export function DocumentsExportButton({
  filters,
  total,
}: {
  filters: DocumentFilters;
  total: number;
}) {
  const [state, setState] = useState<ExportState>("idle");
  const [message, setMessage] = useState("");

  async function handleExport() {
    setState("loading");
    setMessage("");

    try {
      const documents = await getDocumentsForExport(filters);
      downloadDocumentsCsv(documents);

      setState("success");
      setMessage(`${documents.length} documentos exportados.`);

      window.setTimeout(() => {
        setState("idle");
        setMessage("");
      }, 2400);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo exportar.",
      );
    }
  }

  async function handleZipExport() {
    setState("loading");
    setMessage("");

    try {
      const response = await fetch(documentZipExportUrl(filters), {
        headers: clientAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message ?? "No se pudo generar el ZIP.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `spulso-documentos-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      setState("success");
      setMessage("ZIP documental descargado.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo exportar ZIP.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={total === 0 || state === "loading"}
        onClick={handleExport}
        type="button"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {state === "loading" ? "Preparando..." : "Exportar Excel"}
      </button>
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={total === 0 || state === "loading"}
        onClick={handleZipExport}
        type="button"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
        Exportar ZIP
      </button>
      {state !== "idle" ? (
        <ActionFeedback
          message={
            state === "loading"
              ? `Preparando hasta ${IMMEDIATE_EXPORT_ROW_LIMIT.toLocaleString("es-PE")} documentos filtrados...`
              : message
          }
          tone={
            state === "error"
              ? "error"
              : state === "success"
                ? "success"
                : "loading"
          }
        />
      ) : null}
      <BackgroundExportButton
        disabled={total === 0}
        filters={filters}
        type="DOCUMENTS"
      />
    </div>
  );
}

function downloadDocumentsCsv(documents: EmployeeDocument[]) {
  const headers = [
    "Titulo",
    "Tipo",
    "Estado",
    "Trabajador",
    "Empresa",
    "Emision",
    "Vencimiento",
    "Archivo",
  ];
  const rows = documents.map((document) => [
    document.title,
    typeLabel(document.type),
    statusLabel(document.status),
    `${document.employee.firstName} ${document.employee.lastName}`,
    document.company.name,
    document.issuedAt ? formatDate(document.issuedAt) : "",
    document.expiresAt ? formatDate(document.expiresAt) : "",
    document.fileUrl ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `spulso-documentos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function typeLabel(type: EmployeeDocument["type"]) {
  const labels = {
    CONTRACT: "Contrato",
    PAYSLIP: "Boleta",
    POLICY: "Politica",
    CERTIFICATE: "Certificado",
    OTHER: "Otro",
  };

  return labels[type];
}

function statusLabel(status: EmployeeDocument["status"]) {
  const labels = {
    DRAFT: "Borrador",
    PENDING_SIGNATURE: "Pendiente de firma",
    SIGNED: "Firmado",
    EXPIRED: "Vencido",
  };

  return labels[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
