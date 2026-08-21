import 'dotenv/config';

type MetricsResponse = {
  exportJobs?: {
    byStatus?: Record<string, number>;
    last24Hours?: { completed?: number; failed?: number };
    pending?: {
      oldestAgeMs?: number;
      oldestCreatedAt?: string | null;
      oldestJobId?: string | null;
    };
    storage?: { driver?: string; retentionDays?: number };
    worker?: {
      apiWorkerEnabled?: boolean;
      batchSize?: number;
      intervalMs?: number;
    };
  };
  status?: string;
};

type Alert = {
  message: string;
  severity: 'critical' | 'warning';
};

async function main() {
  const url =
    process.env.OBSERVABILITY_METRICS_URL ??
    process.env.OBSERVABILITY_URL ??
    'http://localhost:3001/health/metrics';
  const token = process.env.OBSERVABILITY_TOKEN;
  const response = await fetch(url, {
    headers: token ? { 'x-observability-token': token } : {},
  });

  if (!response.ok) {
    throw new Error(`Metricas no disponibles: ${response.status}`);
  }

  const metrics = (await response.json()) as MetricsResponse;
  const alerts = evaluate(metrics);

  if (alerts.length > 0) {
    console.error(
      JSON.stringify(
        {
          alerts,
          event: 'spulso.observability.alert',
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  console.log(
    JSON.stringify(
      {
        event: 'spulso.observability.ok',
        exportJobs: metrics.exportJobs,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function evaluate(metrics: MetricsResponse) {
  const exportJobs = metrics.exportJobs;
  const alerts: Alert[] = [];

  if (metrics.status !== 'ok' || !exportJobs) {
    return [
      {
        message: 'El endpoint de metricas no retorno estado operativo.',
        severity: 'critical' as const,
      },
    ];
  }

  const maxPendingAgeMs = numberFromEnv(
    'EXPORT_ALERT_MAX_PENDING_AGE_MS',
    10 * 60_000,
  );
  const maxFailedLast24Hours = numberFromEnv('EXPORT_ALERT_MAX_FAILED_24H', 0);
  const maxProcessing = numberFromEnv('EXPORT_ALERT_MAX_PROCESSING', 20);
  const pendingAgeMs = exportJobs.pending?.oldestAgeMs ?? 0;
  const failedLast24Hours = exportJobs.last24Hours?.failed ?? 0;
  const processing = exportJobs.byStatus?.PROCESSING ?? 0;

  if (pendingAgeMs > maxPendingAgeMs) {
    alerts.push({
      message: `Hay un reporte pendiente hace ${pendingAgeMs}ms. Job: ${exportJobs.pending?.oldestJobId ?? 'desconocido'}.`,
      severity: 'critical',
    });
  }

  if (failedLast24Hours > maxFailedLast24Hours) {
    alerts.push({
      message: `Hay ${failedLast24Hours} reportes fallidos en las ultimas 24 horas.`,
      severity: 'warning',
    });
  }

  if (processing > maxProcessing) {
    alerts.push({
      message: `Hay ${processing} reportes en PROCESSING, sobre el limite ${maxProcessing}.`,
      severity: 'warning',
    });
  }

  return alerts;
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        event: 'spulso.observability.error',
        message: error instanceof Error ? error.message : 'Error desconocido.',
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
});
