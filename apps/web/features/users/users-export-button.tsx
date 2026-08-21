"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { BackgroundExportButton } from "@/features/export-jobs/background-export-button";
import { IMMEDIATE_EXPORT_ROW_LIMIT } from "@/lib/export-limits";
import { escapeCsvValue } from "@/lib/csv";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { getUsersForExport } from "./api";
import type { AppUser, UserFilters } from "./types";

type ExportState = "idle" | "loading" | "success" | "error";

export function UsersExportButton({
  filters,
  total,
}: {
  filters: UserFilters;
  total: number;
}) {
  const [state, setState] = useState<ExportState>("idle");
  const [message, setMessage] = useState("");

  async function handleExport() {
    setState("loading");
    setMessage("");

    try {
      const users = await getUsersForExport(filters);
      downloadUsersCsv(users);

      setState("success");
      setMessage(`${users.length} usuarios exportados.`);

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
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-[260px]">
      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-60"
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
              ? `Preparando hasta ${IMMEDIATE_EXPORT_ROW_LIMIT.toLocaleString("es-PE")} usuarios filtrados...`
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
      <BackgroundExportButton disabled={total === 0} filters={filters} type="USERS" />
    </div>
  );
}

function downloadUsersCsv(users: AppUser[]) {
  const headers = [
    "Nombres",
    "Apellidos",
    "Correo",
    "Rol",
    "Empresa",
    "Estado",
    "Creado",
  ];
  const rows = users.map((user) => [
    user.firstName,
    user.lastName,
    user.email,
    user.role?.name ?? "Sin rol",
    user.company?.name ?? "Grupo completo",
    statusLabel(user.status),
    formatDate(user.createdAt),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `spulso-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: AppUser["status"]) {
  const labels = {
    ACTIVE: "Activo",
    INVITED: "Invitado",
    INACTIVE: "Inactivo",
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
