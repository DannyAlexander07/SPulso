import { Clock3, Database, FileDown, FileWarning, Rows3 } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { CrudSection } from "@/components/ui/crud-section";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/surface";
import type { AuthUser } from "@/features/auth/types";
import { ExportJobDownloadButton } from "./export-job-download-button";
import type { ExportJob, ExportJobStatus, ExportJobType } from "./types";

export function ExportJobsView({
  currentUser,
  exportJobs,
}: {
  currentUser: AuthUser | null;
  exportJobs: ExportJob[];
}) {
  const completed = exportJobs.filter((job) => job.status === "COMPLETED").length;
  const pending = exportJobs.filter((job) =>
    ["PENDING", "PROCESSING"].includes(job.status),
  ).length;
  const failed = exportJobs.filter((job) => job.status === "FAILED").length;
  const totalRows = exportJobs.reduce((sum, job) => sum + job.rowCount, 0);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/reportes" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar
            currentUser={currentUser}
            eyebrow="Reportes"
            title="Mis reportes"
          />

          <div className="w-full px-4 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-4">
            <section className="grid gap-3 md:grid-cols-4">
              <MetricCard
                icon={FileDown}
                label="Reportes"
                value={exportJobs.length.toString()}
              />
              <MetricCard
                icon={Clock3}
                label="En cola"
                tone="warning"
                value={pending.toString()}
              />
              <MetricCard
                icon={Rows3}
                label="Filas listas"
                tone="success"
                value={totalRows.toLocaleString("es-PE")}
              />
              <MetricCard
                icon={FileWarning}
                label="Fallidos"
                tone={failed > 0 ? "danger" : "neutral"}
                value={failed.toString()}
              />
            </section>

            <CrudSection
              className="mt-3"
              description={
                exportJobs.length > 0
                  ? `${completed} completados de los ultimos ${exportJobs.length} reportes solicitados.`
                  : "Los reportes en segundo plano apareceran aqui cuando se soliciten desde listas grandes."
              }
              eyebrow="Centro de descargas"
              title="Reportes generados"
            >
              {exportJobs.length > 0 ? (
                <div className="overflow-hidden rounded-[16px] border border-[#e1e5eb] bg-white">
                  <div className="hidden grid-cols-[1.35fr_1fr_1fr_0.7fr_1fr_auto] gap-3 border-b border-[#e1e5eb] bg-[#fbfcfd] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#667085] lg:grid">
                    <span>Reporte</span>
                    <span>Solicitado por</span>
                    <span>Empresa</span>
                    <span>Filas</span>
                    <span>Fechas</span>
                    <span>Accion</span>
                  </div>
                  <div className="divide-y divide-[#eef1f5]">
                    {exportJobs.map((job) => (
                      <ReportJobRow job={job} key={job.id} />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  description="Genera un reporte en segundo plano desde trabajadores, documentos, solicitudes o usuarios."
                  icon={Database}
                  title="Aun no hay reportes generados"
                />
              )}
            </CrudSection>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportJobRow({ job }: { job: ExportJob }) {
  const status = statusLabel(job.status);

  return (
    <article className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-[1.35fr_1fr_1fr_0.7fr_1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="font-semibold text-[#1f242d]">{typeLabel(job.type)}</p>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-[#667085]">
          {job.fileName ?? job.errorMessage ?? "Archivo pendiente"}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium">
          {job.requestedBy.firstName} {job.requestedBy.lastName}
        </p>
        <p className="truncate text-xs text-[#667085]">{job.requestedBy.email}</p>
      </div>

      <p className="min-w-0 truncate text-[#475467]">
        {job.company?.name ?? "Grupo completo"}
      </p>

      <p className="font-semibold text-[#1f242d]">
        {job.rowCount.toLocaleString("es-PE")}
      </p>

      <div className="min-w-0 text-xs leading-5 text-[#667085]">
        <p>Creado: {formatDateTime(job.createdAt)}</p>
        <p>
          {job.completedAt
            ? `Listo: ${formatDateTime(job.completedAt)}`
            : job.startedAt
              ? `Inicio: ${formatDateTime(job.startedAt)}`
              : "Esperando worker"}
        </p>
      </div>

      <ExportJobDownloadButton job={job} />
    </article>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: ExportJobStatus) {
  return {
    COMPLETED: { label: "Listo", tone: "success" as const },
    FAILED: { label: "Fallido", tone: "danger" as const },
    PENDING: { label: "En cola", tone: "warning" as const },
    PROCESSING: { label: "Procesando", tone: "info" as const },
  }[status];
}

function typeLabel(type: ExportJobType) {
  return {
    DOCUMENTS: "Documentos",
    EMPLOYEES: "Trabajadores",
    REQUESTS: "Solicitudes",
    USERS: "Usuarios",
  }[type];
}
