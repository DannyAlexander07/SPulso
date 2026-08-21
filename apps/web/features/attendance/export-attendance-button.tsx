"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { escapeCsvValue } from "@/lib/csv";
import type { AttendanceRecord } from "./types";

export function ExportAttendanceButton({
  filenameDate,
  records,
}: {
  filenameDate?: string;
  records: AttendanceRecord[];
}) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function handleExport() {
    setState("loading");
    setMessage("Preparando asistencia...");

    window.setTimeout(() => {
      try {
        const headers = [
          "Fecha",
          "Trabajador",
          "Cargo",
          "Empresa",
          "Ingreso",
          "Salida",
          "Origen",
          "Estado",
          "GPS entrada",
          "GPS salida",
        ];

        const rows = records.map((record) => [
          formatDate(record.workDate),
          `${record.employee.firstName} ${record.employee.lastName}`,
          record.employee.jobTitle ?? "",
          record.company.name,
          formatTime(record.checkIn),
          formatTime(record.checkOut),
          record.source === "worker" ? "Trabajador" : "Manual",
          statusLabel(record.status),
          gpsValue(record.checkInLatitude, record.checkInLongitude),
          gpsValue(record.checkOutLatitude, record.checkOutLongitude),
        ]);

        const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(";")).join("\r\n");
        const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `spulso-asistencia-${filenameDate ?? new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setState("success");
        setMessage(`${records.length} registros exportados.`);
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "No se pudo exportar la asistencia.");
      } finally {
        window.setTimeout(() => setState("idle"), 2600);
      }
    }, 220);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl bg-[#eef2ff] px-4 text-sm font-semibold text-[#4f46e5] transition hover:bg-[#c7d2fe] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={records.length === 0 || state === "loading"}
        onClick={handleExport}
        type="button"
      >
        <Download className="h-4 w-4 shrink-0" />
        Exportar Excel
      </button>
      {state === "loading" ? <ActionFeedback message={message} tone="loading" /> : null}
      {state === "success" ? <ActionFeedback message={message} tone="success" /> : null}
      {state === "error" ? <ActionFeedback message={message} tone="error" /> : null}
    </div>
  );
}

function gpsValue(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) {
    return "";
  }

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: AttendanceRecord["status"]) {
  const labels = {
    PRESENT: "Presente",
    LATE: "Tardanza",
    ABSENT: "Ausente",
    ON_LEAVE: "Permiso",
  };

  return labels[status];
}
