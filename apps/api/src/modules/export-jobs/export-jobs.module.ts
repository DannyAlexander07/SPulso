import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../storage/file-storage.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ExportJobsController } from './export-jobs.controller';
import { ExportJobsService } from './export-jobs.service';
import { ExportJobsWorkerService } from './export-jobs-worker.service';

@Module({
  imports: [AuditModule, AuthModule, FileStorageModule],
  controllers: [ExportJobsController],
  providers: [ExportJobsService, ExportJobsWorkerService],
  exports: [ExportJobsService, ExportJobsWorkerService],
})
export class ExportJobsModule {}
