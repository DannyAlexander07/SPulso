import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { EmployeeImportsService } from './employee-imports.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeImportsController {
  constructor(private readonly importsService: EmployeeImportsService) {}

  @Get(['trabajadores/importaciones/plantilla', 'employees/imports/template'])
  @Permissions('employees.manage')
  async template(@Res() response: Response) {
    const buffer = await this.importsService.buildTemplate();
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-trabajadores-spulso.xlsx"',
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(buffer);
  }

  @Get(['trabajadores/importaciones', 'employees/imports'])
  @Permissions('employees.manage')
  list(@CurrentUser() actor: AuthUser) {
    return this.importsService.list(actor);
  }

  @Get(['trabajadores/importaciones/:batchId', 'employees/imports/:batchId'])
  @Permissions('employees.manage')
  get(@CurrentUser() actor: AuthUser, @Param('batchId') batchId: string) {
    return this.importsService.get(actor, batchId);
  }

  @Post(['trabajadores/importaciones', 'employees/imports'])
  @Permissions('employees.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 2 },
      fileFilter: (_request, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        const allowedMimeTypes = new Set([
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
          'application/zip',
        ]);
        if (extension !== '.xlsx' || !allowedMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException('Solo se acepta un archivo Excel .xlsx.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(
    @CurrentUser() actor: AuthUser,
    @Body('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.importsService.upload(actor, companyId, file);
  }

  @Patch([
    'trabajadores/importaciones/:batchId/filas/:rowId',
    'employees/imports/:batchId/rows/:rowId',
  ])
  @Permissions('employees.manage')
  updateRow(
    @CurrentUser() actor: AuthUser,
    @Param('batchId') batchId: string,
    @Param('rowId') rowId: string,
    @Body()
    body: {
      version?: unknown;
      data?: Record<string, unknown>;
      attendancePin?: unknown;
    },
  ) {
    return this.importsService.updateRow(actor, batchId, rowId, body);
  }

  @Post([
    'trabajadores/importaciones/:batchId/reintentar',
    'employees/imports/:batchId/retry',
  ])
  @Permissions('employees.manage')
  retry(@CurrentUser() actor: AuthUser, @Param('batchId') batchId: string) {
    return this.importsService.retry(actor, batchId);
  }

  @Post([
    'trabajadores/importaciones/:batchId/filas/:rowId/omitir',
    'employees/imports/:batchId/rows/:rowId/skip',
  ])
  @Permissions('employees.manage')
  skip(
    @CurrentUser() actor: AuthUser,
    @Param('batchId') batchId: string,
    @Param('rowId') rowId: string,
  ) {
    return this.importsService.skip(actor, batchId, rowId);
  }
}
