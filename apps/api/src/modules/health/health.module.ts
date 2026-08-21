import { Module } from '@nestjs/common';
import { ExportJobsModule } from '../export-jobs/export-jobs.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ExportJobsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
