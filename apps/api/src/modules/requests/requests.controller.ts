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
import type { CreateRequestDto } from './dto/create-request.dto';
import { RequestsService } from './requests.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get(['solicitudes', 'requests'])
  @Permissions('requests.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('cursor') cursor?: string,
    @Query('employeeId') employeeId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('pagination') pagination?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.requestsService.findAll(user, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      cursor,
      cursorMode: pagination === 'cursor',
      employeeId,
      page,
      pageSize,
      search,
      status,
      type,
    });
  }

  @Get(['solicitudes/resumen', 'requests/summary'])
  @Permissions('requests.view')
  getSummary(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.requestsService.getSummary(
      user,
      scopedCompanyId(user, companyId) ?? undefined,
    );
  }

  @Post(['solicitudes', 'requests'])
  @Permissions('requests.create')
  create(
    @CurrentUser() user: AuthUser,
    @Body() createRequestDto: CreateRequestDto,
  ) {
    return this.requestsService.create(user, createRequestDto);
  }

  @Patch(['solicitudes/:id/aprobar', 'requests/:id/approve'])
  @Permissions('requests.approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requestsService.decide(user, id, 'APPROVED');
  }

  @Patch(['solicitudes/:id/rechazar', 'requests/:id/reject'])
  @Permissions('requests.approve')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requestsService.decide(user, id, 'REJECTED');
  }
}
