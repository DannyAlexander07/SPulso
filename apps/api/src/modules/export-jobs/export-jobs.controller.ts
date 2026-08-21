import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { basename } from 'path';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import type { CreateExportJobDto } from './dto/create-export-job.dto';
import { ExportJobsService } from './export-jobs.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('exports.manage')
export class ExportJobsController {
  constructor(private readonly exportJobsService: ExportJobsService) {}

  @Get(['exportaciones', 'export-jobs'])
  findAll(@CurrentUser() user: AuthUser) {
    return this.exportJobsService.findAll(user);
  }

  @Get(['exportaciones/:id', 'export-jobs/:id'])
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.exportJobsService.findOne(user, id);
  }

  @Post(['exportaciones', 'export-jobs'])
  create(
    @CurrentUser() user: AuthUser,
    @Body() createExportJobDto: CreateExportJobDto,
  ) {
    return this.exportJobsService.create(user, createExportJobDto);
  }

  @Get(['exportaciones/:id/descargar', 'export-jobs/:id/download'])
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const file = await this.exportJobsService.getDownload(user, id);

    if (!file) {
      throw new NotFoundException('El archivo de exportacion no esta listo.');
    }

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(file.fileName).replace(/"/g, '')}"`,
    );

    return file.stream.pipe(response);
  }
}
