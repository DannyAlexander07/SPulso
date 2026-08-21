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
import { CompaniesService } from './companies.service';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateAttendanceRulesDto } from './dto/update-attendance-rules.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('companies.manage')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(['empresas', 'companies'])
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.companiesService.findAll(user.tenantId, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      search,
      status,
    });
  }

  @Get(['empresas/:id/perfil', 'companies/:id/profile'])
  getProfile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companiesService.getProfile(user, id);
  }

  @Post(['empresas', 'companies'])
  create(
    @CurrentUser() user: AuthUser,
    @Body() createCompanyDto: CreateCompanyDto,
  ) {
    return this.companiesService.create(user, createCompanyDto);
  }

  @Patch(['empresas/:id/reglas-asistencia', 'companies/:id/attendance-rules'])
  updateAttendanceRules(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateAttendanceRulesDto: UpdateAttendanceRulesDto,
  ) {
    return this.companiesService.updateAttendanceRules(
      user,
      id,
      updateAttendanceRulesDto,
    );
  }

  @Patch(['empresas/:id', 'companies/:id'])
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(user, id, updateCompanyDto);
  }
}
