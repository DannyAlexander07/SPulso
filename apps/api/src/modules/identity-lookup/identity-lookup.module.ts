import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityLookupController } from './identity-lookup.controller';
import { IdentityLookupService } from './identity-lookup.service';

@Module({
  imports: [AuditModule],
  controllers: [IdentityLookupController],
  providers: [IdentityLookupService],
})
export class IdentityLookupModule {}
