import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BenefitsController } from './benefits.controller';
import { BenefitsService } from './benefits.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [BenefitsController],
  providers: [BenefitsService],
})
export class BenefitsModule {}
