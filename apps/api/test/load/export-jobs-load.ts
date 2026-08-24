import '../setup-env';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { ExportJobsService } from '../../src/modules/export-jobs/export-jobs.service';
import { SecurityValidationPipe } from '../../src/security/security-validation.pipe';

type ExportJobBody = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  type: string;
};
type LoginBody = { accessToken: string };

const jobTypes = ['EMPLOYEES', 'DOCUMENTS', 'REQUESTS', 'USERS'];
const listEndpoints = [
  '/trabajadores?pageSize=50&pagination=cursor',
  '/documentos?pageSize=50&pagination=cursor',
  '/solicitudes?pageSize=50&pagination=cursor',
  '/usuarios?pageSize=50',
];

async function main() {
  const jobMultiplier = positiveNumber('EXPORT_LOAD_JOB_MULTIPLIER', 2);
  const maxP95Ms = positiveNumber('EXPORT_LOAD_MAX_P95_MS', 2500);
  const maxTotalMs = positiveNumber('EXPORT_LOAD_MAX_TOTAL_MS', 45_000);
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleFixture.createNestApplication();

  app.useGlobalPipes(new SecurityValidationPipe());
  await app.init();

  try {
    const exportJobsService = app.get(ExportJobsService);
    const token = await login(app);
    const startedAt = Date.now();
    const listTimings = await timeListEndpoints(app, token);
    const completedJobs = await createAndCompleteJobs(
      app,
      token,
      exportJobsService,
      jobMultiplier,
    );
    const totalMs = Date.now() - startedAt;
    const p95Ms = percentile(
      listTimings.map((item) => item.durationMs),
      95,
    );

    if (p95Ms > maxP95Ms) {
      throw new Error(`p95 ${p95Ms}ms supera el limite ${maxP95Ms}ms.`);
    }

    if (totalMs > maxTotalMs) {
      throw new Error(`total ${totalMs}ms supera el limite ${maxTotalMs}ms.`);
    }

    console.log(
      JSON.stringify(
        {
          completedJobs: completedJobs.length,
          jobMultiplier,
          listTimings,
          maxP95Ms,
          maxTotalMs,
          p95Ms,
          totalMs,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

async function login(app: INestApplication<App>) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'admin@spulso.local', password: 'Admin1234.' })
    .expect(201);
  const body = response.body as LoginBody;

  return body.accessToken;
}

async function timeListEndpoints(app: INestApplication<App>, token: string) {
  return Promise.all(
    listEndpoints.map(async (endpoint) => {
      const startedAt = Date.now();
      await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      return {
        durationMs: Date.now() - startedAt,
        endpoint,
      };
    }),
  );
}

async function createAndCompleteJobs(
  app: INestApplication<App>,
  token: string,
  exportJobsService: ExportJobsService,
  multiplier: number,
) {
  const payloads = Array.from({ length: multiplier }).flatMap(() =>
    jobTypes.map((type) => ({
      filters: type === 'EMPLOYEES' ? { status: 'ACTIVE' } : {},
      type,
    })),
  );
  const completed: ExportJobBody[] = [];

  for (let index = 0; index < payloads.length; index += 3) {
    const batch = payloads.slice(index, index + 3);
    const responses = await Promise.all(
      batch.map((payload) =>
        request(app.getHttpServer())
          .post('/exportaciones')
          .set('Authorization', `Bearer ${token}`)
          .send(payload)
          .expect(201),
      ),
    );
    const jobs = responses.map((response) => response.body as ExportJobBody);
    completed.push(...(await waitForJobs(app, token, exportJobsService, jobs)));
  }

  return completed;
}

async function waitForJobs(
  app: INestApplication<App>,
  token: string,
  exportJobsService: ExportJobsService,
  jobs: ExportJobBody[],
) {
  const pending = new Set(jobs.map((job) => job.id));
  const completed: ExportJobBody[] = [];

  for (let attempt = 0; attempt < 60 && pending.size > 0; attempt += 1) {
    await exportJobsService.processPendingJobs(10);

    for (const jobId of Array.from(pending)) {
      const response = await request(app.getHttpServer())
        .get(`/exportaciones/${jobId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const job = response.body as ExportJobBody;

      if (job.status === 'FAILED') {
        throw new Error(`La exportacion ${job.id} fallo.`);
      }

      if (job.status === 'COMPLETED') {
        pending.delete(jobId);
        completed.push(job);
      }
    }

    if (pending.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (pending.size > 0) {
    throw new Error(`${pending.size} exportaciones no terminaron a tiempo.`);
  }

  return completed;
}

function percentile(values: number[], percent: number) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percent / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)] ?? 0;
}

function positiveNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
