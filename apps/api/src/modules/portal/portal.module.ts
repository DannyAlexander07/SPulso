import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RequestsModule } from '../requests/requests.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [AuditModule, AuthModule, RequestsModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
