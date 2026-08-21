import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { scopedCompanyId } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AuditService } from './audit.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('audit.view')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(['auditoria', 'audit'])
  findRecent(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('actorType') actorType?: string,
    @Query('companyId') companyId?: string,
    @Query('cursor') cursor?: string,
    @Query('from') from?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('pagination') pagination?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.findRecent(user.tenantId, {
      actorType,
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      cursor,
      cursorMode: pagination === 'cursor',
      from,
      page,
      pageSize,
      search,
      to,
    });
  }
}
