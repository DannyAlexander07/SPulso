import { apiGet, clientAuthHeaders, getApiUrl } from "@/lib/api";
import type { ExportJob, ExportJobType } from "./types";

type CreateExportJobInput = {
  filters: object;
  type: ExportJobType;
};

export async function createExportJob(input: CreateExportJobInput) {
  const response = await fetch(`${getApiUrl()}/exportaciones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...clientAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo crear el reporte.");
  }

  return response.json() as Promise<ExportJob>;
}

export async function getExportJob(jobId: string) {
  const response = await fetch(`${getApiUrl()}/exportaciones/${jobId}`, {
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo consultar el reporte.");
  }

  return response.json() as Promise<ExportJob>;
}

export async function getExportJobs(token?: string | null) {
  return apiGet<ExportJob[]>("/exportaciones", [], token);
}

export async function downloadExportJob(job: ExportJob) {
  const response = await fetch(
    `${getApiUrl()}/exportaciones/${job.id}/descargar`,
    {
      headers: clientAuthHeaders(),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo descargar el reporte.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = job.fileName ?? "spulso-reporte.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
