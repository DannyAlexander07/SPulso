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
import { BenefitsService } from './benefits.service';
import type { CreateBenefitDto, UpdateBenefitDto } from './dto/benefit.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BenefitsController {
  constructor(private readonly benefitsService: BenefitsService) {}

  @Get(['beneficios', 'benefits'])
  @Permissions('benefits.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('scope') scope?: string,
    @Query('search') search?: string,
  ) {
    return this.benefitsService.findAll(user.tenantId, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      scope,
      search,
      status,
    });
  }

  @Post(['beneficios', 'benefits'])
  @Permissions('benefits.manage')
  create(
    @CurrentUser() user: AuthUser,
    @Body() createBenefitDto: CreateBenefitDto,
  ) {
    return this.benefitsService.create(user, createBenefitDto);
  }

  @Patch(['beneficios/:id', 'benefits/:id'])
  @Permissions('benefits.manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateBenefitDto: UpdateBenefitDto,
  ) {
    return this.benefitsService.update(user, id, updateBenefitDto);
  }
}
