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
import { AnnouncementsService } from './announcements.service';
import type {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get(['comunicados', 'announcements'])
  @Permissions('announcements.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('priority') priority?: string,
    @Query('companyId') companyId?: string,
    @Query('scope') scope?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.announcementsService.findAll(user.tenantId, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      priority,
      scope,
      search,
      status,
    });
  }

  @Get(['comunicados/:id', 'announcements/:id'])
  @Permissions('announcements.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.announcementsService.findOne(user, id);
  }

  @Post(['comunicados', 'announcements'])
  @Permissions('announcements.manage')
  create(
    @CurrentUser() user: AuthUser,
    @Body() createAnnouncementDto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(user, createAnnouncementDto);
  }

  @Patch(['comunicados/:id', 'announcements/:id'])
  @Permissions('announcements.manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(user, id, updateAnnouncementDto);
  }

  @Post(['comunicados/:id/enviar-correos', 'announcements/:id/send-emails'])
  @Permissions('announcements.manage')
  sendPendingEmails(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.announcementsService.sendPendingEmails(user, id);
  }
}
