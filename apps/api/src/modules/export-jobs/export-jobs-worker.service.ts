import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ExportJobsService } from './export-jobs.service';

@Injectable()
export class ExportJobsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportJobsWorkerService.name);
  private cleanupInterval?: NodeJS.Timeout;
  private isRunning = false;
  private interval?: NodeJS.Timeout;

  constructor(private readonly exportJobsService: ExportJobsService) {}

  onModuleInit() {
    if (process.env.EXPORT_JOBS_API_WORKER === 'false') {
      return;
    }

    this.start();
  }

  onModuleDestroy() {
    this.stop();
  }

  start() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.processOnce();
    }, this.intervalMs());
    this.interval.unref?.();
    this.cleanupInterval = setInterval(() => {
      void this.cleanupOnce();
    }, this.cleanupIntervalMs());
    this.cleanupInterval.unref?.();
    void this.processOnce();
    void this.cleanupOnce();
  }

  stop() {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = undefined;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  async processOnce() {
    if (this.isRunning) {
      return 0;
    }

    this.isRunning = true;
    const startedAt = Date.now();

    try {
      const processed = await this.exportJobsService.processPendingJobs(
        this.batchSize(),
      );

      if (processed > 0) {
        this.logger.log(
          JSON.stringify({
            event: 'export_jobs.worker_cycle',
            processed,
            durationMs: Date.now() - startedAt,
            batchSize: this.batchSize(),
            timestamp: new Date().toISOString(),
          }),
        );
      }

      return processed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido.';
      this.logger.error({
        event: 'export_jobs.worker_error',
        message,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
      return 0;
    } finally {
      this.isRunning = false;
    }
  }

  async runForever() {
    this.logger.log('Worker de exportaciones iniciado.');
    this.start();

    await new Promise<void>((resolve) => {
      const shutdown = () => resolve();

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    });

    this.stop();
    this.logger.log('Worker de exportaciones detenido.');
  }

  private async cleanupOnce() {
    const startedAt = Date.now();

    try {
      const removed = await this.exportJobsService.cleanupExpiredFiles();

      if (removed > 0) {
        this.logger.log(
          JSON.stringify({
            event: 'export_jobs.cleanup_cycle',
            removed,
            durationMs: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido.';
      this.logger.error({
        event: 'export_jobs.cleanup_error',
        message,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private batchSize() {
    return Number(process.env.EXPORT_JOBS_WORKER_BATCH_SIZE ?? 5);
  }

  private intervalMs() {
    return Number(process.env.EXPORT_JOBS_WORKER_INTERVAL_MS ?? 500);
  }

  private cleanupIntervalMs() {
    return Number(process.env.EXPORT_JOBS_CLEANUP_INTERVAL_MS ?? 60 * 60_000);
  }
}
