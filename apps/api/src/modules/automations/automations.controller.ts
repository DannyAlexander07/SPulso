import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import type { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { AutomationsService } from './automations.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get(['automatizaciones', 'automations'])
  @Permissions('automations.view')
  findAll(@CurrentUser() user: AuthUser) {
    return this.automationsService.findAll(user.tenantId);
  }

  @Patch(['automatizaciones/:id', 'automations/:id'])
  @Permissions('automations.manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateAutomationRuleDto: UpdateAutomationRuleDto,
  ) {
    return this.automationsService.update(
      user.tenantId,
      id,
      updateAutomationRuleDto,
    );
  }
}
