import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ExportJobsService } from '../export-jobs/export-jobs.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly exportJobsService: ExportJobsService,
    private readonly prisma: PrismaService,
  ) {}

  async check() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      app: 'SPulso API',
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async metrics(token?: string) {
    this.assertMetricsAccess(token);
    await this.prisma.$queryRaw`SELECT 1`;
    const metrics = await this.exportJobsService.metrics();

    return {
      status: 'ok',
      database: 'ok',
      ...metrics,
    };
  }

  private assertMetricsAccess(token?: string) {
    const expectedToken = process.env.OBSERVABILITY_TOKEN?.trim();

    if (expectedToken) {
      if (token !== expectedToken) {
        throw new UnauthorizedException('Token de observabilidad invalido.');
      }

      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'OBSERVABILITY_TOKEN no esta configurado.',
      );
    }
  }
}
