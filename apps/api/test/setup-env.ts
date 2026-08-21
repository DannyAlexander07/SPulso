import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.EXPORT_JOBS_API_WORKER = 'false';
process.env.EXPORT_JOBS_WORKER_INTERVAL_MS =
  process.env.EXPORT_JOBS_WORKER_INTERVAL_MS ?? '50';
