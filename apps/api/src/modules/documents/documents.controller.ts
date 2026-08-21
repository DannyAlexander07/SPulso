import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { scopedCompanyId } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import type {
  CreateDocumentDto,
  CreateDocumentFolderDto,
} from './dto/create-document.dto';
import type {
  UpdateDocumentDto,
  UpdateDocumentFolderDto,
} from './dto/update-document.dto';
import { DocumentsService } from './documents.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(['documentos', 'documents'])
  @Permissions('documents.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('cursor') cursor?: string,
    @Query('employeeId') employeeId?: string,
    @Query('expiresFrom') expiresFrom?: string,
    @Query('expiresTo') expiresTo?: string,
    @Query('folder') folder?: string,
    @Query('folderId') folderId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('pagination') pagination?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.documentsService.findAll(user, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      cursor,
      cursorMode: pagination === 'cursor',
      employeeId,
      expiresFrom,
      expiresTo,
      folder,
      folderId,
      page,
      pageSize,
      search,
      status,
      type,
    });
  }

  @Get(['documentos/carpetas', 'documents/folders'])
  @Permissions('documents.view')
  getFolders(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.documentsService.getFolders(
      user.tenantId,
      scopedCompanyId(user, companyId) ?? undefined,
    );
  }

  @Post(['documentos/carpetas', 'documents/folders'])
  @Permissions('documents.manage')
  createFolder(
    @CurrentUser() user: AuthUser,
    @Body() createFolderDto: CreateDocumentFolderDto,
  ) {
    return this.documentsService.createFolder(user, createFolderDto);
  }

  @Patch(['documentos/carpetas/:id', 'documents/folders/:id'])
  @Permissions('documents.manage')
  updateFolder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateDocumentFolderDto,
  ) {
    return this.documentsService.updateFolder(user, id, updateFolderDto);
  }

  @Delete(['documentos/carpetas/:id', 'documents/folders/:id'])
  @Permissions('documents.manage')
  deleteFolder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentsService.deleteFolder(user, id);
  }

  @Get(['documentos/resumen', 'documents/summary'])
  @Permissions('documents.view')
  getSummary(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.documentsService.getSummary(
      user,
      scopedCompanyId(user, companyId) ?? undefined,
    );
  }

  @Post(['documentos', 'documents'])
  @Permissions('documents.manage')
  create(
    @CurrentUser() user: AuthUser,
    @Body() createDocumentDto: CreateDocumentDto,
  ) {
    return this.documentsService.create(user, createDocumentDto);
  }

  @Get(['documentos/exportar/zip', 'documents/export/zip'])
  @Permissions('documents.view')
  exportZip(
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
    @Query('companyId') companyId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('folderId') folderId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.documentsService.exportZip(user, response, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      employeeId,
      folderId,
      status,
      type,
    });
  }

  @Patch(['documentos/:id', 'documents/:id'])
  @Permissions('documents.manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(user, id, updateDocumentDto);
  }

  @Delete(['documentos/:id', 'documents/:id'])
  @Permissions('documents.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documentsService.remove(user, id);
  }
}
