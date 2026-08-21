import { Controller, Get, Headers } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.check();
  }

  @Get('metrics')
  metrics(@Headers('x-observability-token') token?: string) {
    return this.healthService.metrics(token);
  }
}
