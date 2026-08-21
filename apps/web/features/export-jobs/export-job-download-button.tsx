"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { downloadExportJob } from "./api";
import type { ExportJob } from "./types";

export function ExportJobDownloadButton({ job }: { job: ExportJob }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const ready = job.status === "COMPLETED" && Boolean(job.fileName);

  async function handleDownload() {
    if (!ready || loading) return;

    setError("");
    setLoading(true);

    try {
      await downloadExportJob(job);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el reporte.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-xs font-bold text-[#475467] transition hover:border-[#0891b2] hover:bg-[#ecfeff] hover:text-[#0e7490] disabled:cursor-not-allowed disabled:opacity-55"
        disabled={!ready || loading}
        onClick={handleDownload}
        type="button"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Descargar
      </button>
      {error ? (
        <p className="max-w-[210px] text-xs leading-4 text-[#b42318]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
