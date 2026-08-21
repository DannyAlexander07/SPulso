"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { BackgroundExportButton } from "@/features/export-jobs/background-export-button";
import { IMMEDIATE_EXPORT_ROW_LIMIT } from "@/lib/export-limits";
import { escapeCsvValue } from "@/lib/csv";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { getRequestsForExport } from "./api";
import type { EmployeeRequest, RequestFilters } from "./types";

type ExportState = "idle" | "loading" | "success" | "error";

export function RequestsExportButton({
  filters,
  total,
}: {
  filters: RequestFilters;
  total: number;
}) {
  const [state, setState] = useState<ExportState>("idle");
  const [message, setMessage] = useState("");

  async function handleExport() {
    setState("loading");
    setMessage("");

    try {
      const requests = await getRequestsForExport(filters);
      downloadRequestsCsv(requests);

      setState("success");
      setMessage(`${requests.length} solicitudes exportadas.`);

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
      {state !== "idle" ? (
        <ActionFeedback
          message={
            state === "loading"
              ? `Preparando hasta ${IMMEDIATE_EXPORT_ROW_LIMIT.toLocaleString("es-PE")} solicitudes filtradas...`
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
        type="REQUESTS"
      />
    </div>
  );
}

function downloadRequestsCsv(requests: EmployeeRequest[]) {
  const headers = [
    "Titulo",
    "Tipo",
    "Estado",
    "Trabajador",
    "Empresa",
    "Inicio",
    "Fin",
    "Descripcion",
  ];
  const rows = requests.map((request) => [
    request.title,
    typeLabel(request.type),
    statusLabel(request.status),
    `${request.employee.firstName} ${request.employee.lastName}`,
    request.company.name,
    formatDate(request.startDate),
    request.endDate
      ? formatDate(request.endDate)
      : formatDate(request.startDate),
    request.description ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `spulso-solicitudes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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

function statusLabel(status: EmployeeRequest["status"]) {
  const labels = {
    PENDING: "Pendiente",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    CANCELLED: "Cancelada",
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
