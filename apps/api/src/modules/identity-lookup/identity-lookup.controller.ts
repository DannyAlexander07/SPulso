import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { IdentityLookupService } from './identity-lookup.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IdentityLookupController {
  constructor(private readonly identityLookupService: IdentityLookupService) {}

  @Get(['consultas/documentos/:numero', 'identity-lookup/documents/:numero'])
  @Permissions('employees.manage')
  lookupDocument(
    @CurrentUser() actor: AuthUser,
    @Param('numero') numero: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.identityLookupService.lookupDocument(actor, numero, companyId);
  }
}
