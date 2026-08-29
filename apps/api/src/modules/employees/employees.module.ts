import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeImportsController } from './employee-imports.controller';
import { EmployeeImportsService } from './employee-imports.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [EmployeeImportsController, EmployeesController],
  providers: [EmployeeImportsService, EmployeesService],
})
export class EmployeesModule {}
