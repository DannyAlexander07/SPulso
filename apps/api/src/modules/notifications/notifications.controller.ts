import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { NotificationsService } from './notifications.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(['notificaciones', 'notifications'])
  @Permissions('notifications.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('pagination') pagination?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationsService.findAll(user, {
      page,
      pageSize,
      cursor,
      cursorMode: pagination === 'cursor',
      priority,
      status,
      type,
    });
  }

  @Get(['notificaciones/resumen', 'notifications/summary'])
  @Permissions('notifications.view')
  getSummary(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getSummary(user);
  }

  @Patch(['notificaciones/:id/leida', 'notifications/:id/read'])
  @Permissions('notifications.view')
  markAsRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user, id);
  }

  @Patch(['notificaciones/:id/no-leida', 'notifications/:id/unread'])
  @Permissions('notifications.view')
  markAsUnread(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.markAsUnread(user, id);
  }
}
