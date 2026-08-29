type Result = { durationMs: number; ok: boolean; status: number };

const baseUrl = requiredEnvironment('LOAD_BASE_URL').replace(/\/$/, '');
const email = requiredEnvironment('LOAD_EMAIL');
const password = requiredEnvironment('LOAD_PASSWORD');
const virtualUsers = boundedInteger(process.env.LOAD_VUS, 10, 1, 100);
const thinkTimeMs = boundedInteger(
  process.env.LOAD_THINK_TIME_MS,
  1_000,
  0,
  10_000,
);
const durationSeconds = boundedInteger(
  process.env.LOAD_DURATION_SECONDS,
  60,
  5,
  600,
);
const allowedProduction = process.env.LOAD_ALLOW_PRODUCTION === 'true';
const useWebBff = process.env.LOAD_WEB_BFF === 'true';

if (
  !allowedProduction &&
  !/localhost|127\.0\.0\.1|staging|preprod|host\.docker\.internal|spulso\.altaterraresources\.com\.pe/i.test(
    baseUrl,
  )
) {
  throw new Error(
    'La carga representativa solo puede ejecutarse contra preproduccion. Usa LOAD_ALLOW_PRODUCTION=true unicamente durante una ventana autorizada.',
  );
}

void main();

async function main() {
  const loginResponse = await fetch(
    `${baseUrl}${useWebBff ? '/api/auth/login' : '/auth/login'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!loginResponse.ok)
    throw new Error('No se pudo autenticar el usuario de carga.');
  const loginBody = (await loginResponse.json()) as { accessToken?: string };
  const sessionCookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  if (!useWebBff && !loginBody.accessToken)
    throw new Error('La autenticacion no devolvio token.');
  if (useWebBff && !sessionCookie)
    throw new Error('La autenticacion web no devolvio cookie de sesion.');

  const paths = [
    '/health',
    '/trabajadores?pageSize=20&pagination=cursor',
    '/organizacion',
    '/asistencia/resumen',
    '/notificaciones',
  ];
  const deadline = Date.now() + durationSeconds * 1000;
  const results: Result[] = [];

  await Promise.all(
    Array.from({ length: virtualUsers }, (_, worker) => runWorker(worker)),
  );

  async function runWorker(worker: number) {
    let requestIndex = worker;
    while (Date.now() < deadline) {
      const path = paths[requestIndex % paths.length];
      const requestPath =
        useWebBff && path !== '/health' ? `/api/spulso${path}` : path;
      requestIndex += 1;
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}${requestPath}`, {
          headers: useWebBff
            ? { Cookie: sessionCookie ?? '' }
            : { Authorization: `Bearer ${loginBody.accessToken}` },
        });
        await response.arrayBuffer();
        results.push({
          durationMs: performance.now() - started,
          ok: response.ok,
          status: response.status,
        });
      } catch {
        results.push({
          durationMs: performance.now() - started,
          ok: false,
          status: 0,
        });
      }
      if (thinkTimeMs > 0)
        await new Promise((resolve) => setTimeout(resolve, thinkTimeMs));
    }
  }

  const durations = results
    .map((result) => result.durationMs)
    .sort((a, b) => a - b);
  const failed = results.filter((result) => !result.ok);
  const summary = {
    requests: results.length,
    failed: failed.length,
    errorRate: results.length ? failed.length / results.length : 1,
    durationSeconds,
    virtualUsers,
    thinkTimeMs,
    transport: useWebBff ? 'web-bff' : 'api',
    requestsPerSecond: results.length / durationSeconds,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    statusCounts: Object.fromEntries(
      Array.from(new Set(results.map((result) => result.status))).map(
        (status) => [
          status,
          results.filter((result) => result.status === status).length,
        ],
      ),
    ),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (summary.errorRate > 0.01 || summary.p95Ms > 1_500) process.exitCode = 2;
}

function percentile(values: number[], quantile: number) {
  if (!values.length) return 0;
  return Math.round(
    values[Math.min(values.length - 1, Math.floor(values.length * quantile))],
  );
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatorio.`);
  return value;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`El parametro de carga debe estar entre ${min} y ${max}.`);
  }
  return parsed;
}
