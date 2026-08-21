"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { createExportJob, downloadExportJob, getExportJob } from "./api";
import type { ExportJob, ExportJobType } from "./types";

type BackgroundExportState = "idle" | "creating" | "processing" | "ready" | "error";

export function BackgroundExportButton({
  disabled,
  filters,
  label = "Reporte en segundo plano",
  type,
}: {
  disabled?: boolean;
  filters: object;
  label?: string;
  type: ExportJobType;
}) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<BackgroundExportState>("idle");

  async function handleCreate() {
    setState("creating");
    setMessage("");
    setJob(null);

    try {
      const created = await createExportJob({ filters, type });
      setJob(created);
      setState("processing");
      setMessage("Generando reporte en segundo plano...");

      const completed = await waitForJob(created.id);

      if (completed.status === "FAILED") {
        throw new Error(
          completed.errorMessage ?? "No se pudo generar el reporte.",
        );
      }

      setJob(completed);
      setState("ready");
      setMessage(`${completed.rowCount} filas listas para descargar.`);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo generar el reporte.",
      );
    }
  }

  async function handleDownload() {
    if (!job) return;

    try {
      await downloadExportJob(job);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo descargar el reporte.",
      );
    }
  }

  const busy = state === "creating" || state === "processing";

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475467] transition hover:border-[#0891b2] hover:bg-[#ecfeff] hover:text-[#0e7490] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || busy}
        onClick={state === "ready" ? handleDownload : handleCreate}
        type="button"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {state === "ready" ? "Descargar reporte" : label}
      </button>
      {state !== "idle" ? (
        <ActionFeedback
          message={
            busy
              ? state === "creating"
                ? "Creando reporte..."
                : message
              : message
          }
          tone={
            state === "error"
              ? "error"
              : state === "ready"
                ? "success"
                : "loading"
          }
        />
      ) : null}
    </div>
  );
}

async function waitForJob(jobId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = await getExportJob(jobId);

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      return job;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }

  throw new Error("El reporte sigue procesandose. Intentalo nuevamente en unos segundos.");
}
