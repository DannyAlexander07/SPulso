import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { DatabaseModule } from './database/database.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { BenefitsModule } from './modules/benefits/benefits.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ExportJobsModule } from './modules/export-jobs/export-jobs.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityLookupModule } from './modules/identity-lookup/identity-lookup.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PortalModule } from './modules/portal/portal.module';
import { RequestsModule } from './modules/requests/requests.module';
import { UsersModule } from './modules/users/users.module';
import { MalwareScanModule } from './security/malware-scan.module';

@Module({
  imports: [
    DatabaseModule,
    MalwareScanModule,
    AnnouncementsModule,
    AuditModule,
    AuthModule,
    AutomationsModule,
    BenefitsModule,
    ExportJobsModule,
    FilesModule,
    HealthModule,
    IdentityLookupModule,
    CompaniesModule,
    EmployeesModule,
    AttendanceModule,
    RequestsModule,
    DocumentsModule,
    UsersModule,
    NotificationsModule,
    OrganizationModule,
    PortalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
