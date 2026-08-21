"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { BackgroundExportButton } from "@/features/export-jobs/background-export-button";
import { IMMEDIATE_EXPORT_ROW_LIMIT } from "@/lib/export-limits";
import { escapeCsvValue } from "@/lib/csv";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { getEmployeesForExport } from "./api";
import type { Employee, EmployeeFilters } from "./types";

type ExportState = "idle" | "loading" | "success" | "error";

export function EmployeesExportButton({
  filters,
  total,
}: {
  filters: EmployeeFilters;
  total: number;
}) {
  const [state, setState] = useState<ExportState>("idle");
  const [message, setMessage] = useState("");

  async function handleExport() {
    setState("loading");
    setMessage("");

    try {
      const employees = await getEmployeesForExport(filters);
      downloadEmployeesCsv(employees);

      setState("success");
      setMessage(`${employees.length} trabajadores exportados.`);

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
    <div className="flex min-w-0 flex-col gap-2">
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
              ? `Preparando hasta ${IMMEDIATE_EXPORT_ROW_LIMIT.toLocaleString("es-PE")} resultados filtrados...`
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
        type="EMPLOYEES"
      />
    </div>
  );
}

function downloadEmployeesCsv(employees: Employee[]) {
  const headers = [
    "Nombres",
    "Apellidos",
    "DNI",
    "Codigo",
    "Empresa",
    "Area",
    "Cargo",
    "Equipo",
    "Jefe directo",
    "Ingreso",
    "Estado",
  ];
  const rows = employees.map((employee) => [
    employee.firstName,
    employee.lastName,
    employee.documentNumber ?? "",
    employee.employeeCode ?? "",
    employee.company.name,
    employee.areaRef?.name ?? employee.area ?? "",
    employee.position?.name ?? employee.jobTitle ?? "",
    employee.team?.name ?? "",
    employee.manager
      ? `${employee.manager.firstName} ${employee.manager.lastName}`
      : "",
    employee.hireDate ? formatDate(employee.hireDate) : "",
    statusLabel(employee.status),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `spulso-trabajadores-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function statusLabel(status: Employee["status"]) {
  const labels = {
    ACTIVE: "Activo",
    INACTIVE: "Inactivo",
    TERMINATED: "Cesado",
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
