"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { escapeCsvValue } from "@/lib/csv";
import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { Company } from "./types";

type ExportState = "idle" | "loading" | "success";

export function CompaniesExportButton({ companies }: { companies: Company[] }) {
  const [state, setState] = useState<ExportState>("idle");

  function handleExport() {
    setState("loading");

    const headers = ["Empresa", "Identificador", "RUC", "Entrada", "Tolerancia", "Estado"];
    const rows = companies.map((company) => [
      company.name,
      company.slug,
      company.ruc ?? "",
      company.workStartTime,
      `${company.lateToleranceMinutes} min`,
      company.status === "ACTIVE" ? "Activa" : "Inactiva",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `spulso-empresas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    window.setTimeout(() => {
      setState("success");
      window.setTimeout(() => setState("idle"), 2200);
    }, 450);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={companies.length === 0 || state === "loading"}
        onClick={handleExport}
        type="button"
      >
        {state === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {state === "loading" ? "Preparando..." : "Exportar Excel"}
      </button>
      {state === "loading" ? <ActionFeedback message="Preparando archivo de empresas..." tone="loading" /> : null}
      {state === "success" ? <ActionFeedback message={`${companies.length} empresas exportadas.`} tone="success" /> : null}
    </div>
  );
}
