import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExportJobsWorkerService } from './modules/export-jobs/export-jobs-worker.service';
import { getJwtSecret } from './security/jwt-secret';

async function bootstrap() {
  process.env.EXPORT_JOBS_API_WORKER = 'false';
  getJwtSecret();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const worker = app.get(ExportJobsWorkerService);

  await worker.runForever();
  await app.close();
}

void bootstrap();
