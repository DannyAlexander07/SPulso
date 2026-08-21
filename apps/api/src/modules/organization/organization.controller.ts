import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { scopedCompanyId } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import type {
  CreateAreaDto,
  CreateClientDto,
  CreateEmployeeClientAssignmentDto,
  CreateJobPositionDto,
  CreateWorkTeamDto,
  UpdateAreaDto,
  UpdateClientDto,
  UpdateEmployeeClientAssignmentDto,
  UpdateJobPositionDto,
  UpdateWorkTeamMembersDto,
  UpdateWorkTeamDto,
} from './dto/organization.dto';
import { OrganizationService } from './organization.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get(['organizacion', 'organization'])
  @Permissions('organization.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.organizationService.findAll(user.tenantId, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
    });
  }

  @Post(['organizacion/areas', 'organization/areas'])
  @Permissions('organization.manage')
  createArea(
    @CurrentUser() user: AuthUser,
    @Body() createAreaDto: CreateAreaDto,
  ) {
    return this.organizationService.createArea(user, createAreaDto);
  }

  @Patch(['organizacion/areas/:id', 'organization/areas/:id'])
  @Permissions('organization.manage')
  updateArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    return this.organizationService.updateArea(user, id, updateAreaDto);
  }

  @Post(['organizacion/clientes', 'organization/clients'])
  @Permissions('organization.manage')
  createClient(
    @CurrentUser() user: AuthUser,
    @Body() createClientDto: CreateClientDto,
  ) {
    return this.organizationService.createClient(user, createClientDto);
  }

  @Patch(['organizacion/clientes/:id', 'organization/clients/:id'])
  @Permissions('organization.manage')
  updateClient(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.organizationService.updateClient(user, id, updateClientDto);
  }

  @Post(['organizacion/cargos', 'organization/positions'])
  @Permissions('organization.manage')
  createJobPosition(
    @CurrentUser() user: AuthUser,
    @Body() createJobPositionDto: CreateJobPositionDto,
  ) {
    return this.organizationService.createJobPosition(
      user,
      createJobPositionDto,
    );
  }

  @Patch(['organizacion/cargos/:id', 'organization/positions/:id'])
  @Permissions('organization.manage')
  updateJobPosition(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateJobPositionDto: UpdateJobPositionDto,
  ) {
    return this.organizationService.updateJobPosition(
      user,
      id,
      updateJobPositionDto,
    );
  }

  @Post(['organizacion/equipos', 'organization/teams'])
  @Permissions('organization.manage')
  createWorkTeam(
    @CurrentUser() user: AuthUser,
    @Body() createWorkTeamDto: CreateWorkTeamDto,
  ) {
    return this.organizationService.createWorkTeam(user, createWorkTeamDto);
  }

  @Patch(['organizacion/equipos/:id', 'organization/teams/:id'])
  @Permissions('organization.manage')
  updateWorkTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateWorkTeamDto: UpdateWorkTeamDto,
  ) {
    return this.organizationService.updateWorkTeam(user, id, updateWorkTeamDto);
  }

  @Patch([
    'organizacion/equipos/:id/miembros',
    'organization/teams/:id/members',
  ])
  @Permissions('organization.manage')
  updateWorkTeamMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateWorkTeamMembersDto: UpdateWorkTeamMembersDto,
  ) {
    return this.organizationService.updateWorkTeamMembers(
      user,
      id,
      updateWorkTeamMembersDto,
    );
  }

  @Post(['organizacion/asignaciones', 'organization/assignments'])
  @Permissions('organization.manage')
  createAssignment(
    @CurrentUser() user: AuthUser,
    @Body() createAssignmentDto: CreateEmployeeClientAssignmentDto,
  ) {
    return this.organizationService.createAssignment(user, createAssignmentDto);
  }

  @Patch(['organizacion/asignaciones/:id', 'organization/assignments/:id'])
  @Permissions('organization.manage')
  updateAssignment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateAssignmentDto: UpdateEmployeeClientAssignmentDto,
  ) {
    return this.organizationService.updateAssignment(
      user,
      id,
      updateAssignmentDto,
    );
  }
}
