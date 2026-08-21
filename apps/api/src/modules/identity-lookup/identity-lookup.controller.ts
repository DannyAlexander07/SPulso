import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { IdentityLookupService } from './identity-lookup.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IdentityLookupController {
  constructor(private readonly identityLookupService: IdentityLookupService) {}

  @Get(['consultas/documentos/:numero', 'identity-lookup/documents/:numero'])
  @Permissions('employees.view')
  lookupDocument(@Param('numero') numero: string) {
    return this.identityLookupService.lookupDocument(numero);
  }
}
