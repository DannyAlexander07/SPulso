import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  OrganizationStatus,
  Prisma,
} from '@prisma/client';
import { createReadStream, existsSync } from 'fs';
import { basename, resolve, sep } from 'path';
import type { Response } from 'express';
import {
  buildPaginationMeta,
  sliceCursorPage,
  toOptionalCursor,
} from '../../common/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  assertCompanyAccess,
  employeeVisibilityScope,
  hasGlobalCompanyAccess,
} from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type {
  CreateDocumentDto,
  CreateDocumentFolderDto,
} from './dto/create-document.dto';
import type {
  UpdateDocumentDto,
  UpdateDocumentFolderDto,
} from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    actor: AuthUser,
    filters?: {
      companyId?: string;
      cursor?: string;
      cursorMode?: boolean;
      employeeId?: string;
      expiresFrom?: string;
      expiresTo?: string;
      folder?: string;
      folderId?: string;
      page?: string;
      pageSize?: string;
      search?: string;
      status?: string;
      type?: string;
    },
  ) {
    const tenantId = actor.tenantId;
    const where: Prisma.EmployeeDocumentWhereInput = {
      tenantId,
      employee: employeeVisibilityScope(actor),
    };
    const companyId = this.toOptionalString(filters?.companyId);
    const cursor = toOptionalCursor(filters?.cursor);
    const cursorMode = filters?.cursorMode === true;
    const employeeId = this.toOptionalString(filters?.employeeId);
    const page = this.normalizePage(filters?.page);
    const pageSize = this.normalizePageSize(filters?.pageSize);
    const status = this.normalizeOptionalDocumentStatus(filters?.status);
    const type = this.normalizeOptionalDocumentType(filters?.type);
    const search = this.toOptionalString(filters?.search);
    const folder = this.toOptionalString(filters?.folder);
    const folderId = this.toOptionalString(filters?.folderId);
    const expiresFrom = this.parseOptionalFilterDate(
      filters?.expiresFrom,
      'start',
    );
    const expiresTo = this.parseOptionalFilterDate(filters?.expiresTo, 'end');

    if (companyId) {
      where.companyId = companyId;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (folder) {
      where.folder = { equals: folder, mode: 'insensitive' };
    }

    if (folderId) {
      where.folderId = folderId;
    }

    if (expiresFrom || expiresTo) {
      where.expiresAt = {
        ...(expiresFrom ? { gte: expiresFrom } : {}),
        ...(expiresTo ? { lte: expiresTo } : {}),
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { folder: { contains: search, mode: 'insensitive' } },
        { employee: { firstName: { contains: search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy =
      expiresFrom || expiresTo
        ? [
            { expiresAt: 'asc' as const },
            { createdAt: 'desc' as const },
            { id: 'desc' as const },
          ]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    if (cursor || cursorMode) {
      const items = await this.prisma.employeeDocument.findMany({
        where,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy,
        take: pageSize + 1,
        select: this.documentSelect(),
      });
      const cursorPage = sliceCursorPage(items, pageSize);

      return {
        data: cursorPage.data,
        meta: buildPaginationMeta({
          cursor,
          mode: 'cursor',
          hasNextPage: cursorPage.hasNextPage,
          nextCursor: cursorPage.nextCursor,
          page,
          pageSize,
        }),
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.employeeDocument.count({ where }),
      this.prisma.employeeDocument.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.documentSelect(),
      }),
    ]);

    return {
      data,
      meta: {
        ...buildPaginationMeta({ page, pageSize, total }),
      },
    };
  }

  async getSummary(actor: AuthUser, companyId?: string) {
    const tenantId = actor.tenantId;
    const today = this.getStartOfToday();
    const companyFilter = companyId ? { companyId } : {};
    const employeeFilter = { employee: employeeVisibilityScope(actor) };

    await this.prisma.employeeDocument.updateMany({
      where: {
        status: {
          not: DocumentStatus.EXPIRED,
        },
        tenantId,
        ...companyFilter,
        ...employeeFilter,
        expiresAt: {
          lt: today,
        },
      },
      data: {
        status: DocumentStatus.EXPIRED,
      },
    });

    const groupedDocuments = await this.prisma.employeeDocument.groupBy({
      by: ['status'],
      where: { tenantId, ...companyFilter, ...employeeFilter },
      _count: {
        status: true,
      },
    });

    const counts = {
      draft: 0,
      pendingSignature: 0,
      signed: 0,
      expired: 0,
      total: 0,
    };

    for (const item of groupedDocuments) {
      counts.total += item._count.status;

      if (item.status === DocumentStatus.DRAFT) {
        counts.draft = item._count.status;
      }

      if (item.status === DocumentStatus.PENDING_SIGNATURE) {
        counts.pendingSignature = item._count.status;
      }

      if (item.status === DocumentStatus.SIGNED) {
        counts.signed = item._count.status;
      }

      if (item.status === DocumentStatus.EXPIRED) {
        counts.expired = item._count.status;
      }
    }

    return counts;
  }

  async getFolders(tenantId: string, companyId?: string) {
    await this.ensureDefaultFolders(tenantId);

    return this.prisma.documentFolder.findMany({
      where: {
        tenantId,
        status: OrganizationStatus.ACTIVE,
        ...(companyId ? { OR: [{ companyId: null }, { companyId }] } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: this.folderSelect(),
    });
  }

  async createFolder(actor: AuthUser, dto: CreateDocumentFolderDto) {
    const tenantId = actor.tenantId;
    const name = this.normalizeFolderName(dto.name);
    const companyId = this.toOptionalString(dto.companyId);

    if (companyId) {
      assertCompanyAccess(actor, companyId);
    }

    const type =
      dto.type === null || dto.type === undefined
        ? null
        : this.normalizeDocumentType(dto.type);
    const slug = await this.uniqueFolderSlug(tenantId, name);

    const folder = await this.prisma.documentFolder.create({
      data: {
        tenantId,
        companyId,
        name,
        slug,
        description: this.toOptionalString(dto.description),
        type,
        visibleToEmployee: dto.visibleToEmployee ?? true,
        requiresSignature: dto.requiresSignature ?? false,
        allowMultiple: dto.allowMultiple ?? true,
        retentionYears: this.normalizeOptionalPositiveInt(dto.retentionYears),
        sortOrder: await this.nextFolderSortOrder(tenantId),
      },
      select: this.folderSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'document_folder.created',
      entityType: 'DocumentFolder',
      entityId: folder.id,
      summary: `Se creo la carpeta documental ${folder.name}.`,
      after: this.toJson(folder),
    });

    return folder;
  }

  async updateFolder(
    actor: AuthUser,
    folderId: string,
    dto: UpdateDocumentFolderDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(folderId);

    if (!id) {
      throw new BadRequestException('La carpeta es obligatoria.');
    }

    const folder = await this.prisma.documentFolder.findUnique({
      where: { id },
      select: this.folderWithTenantSelect(),
    });

    if (!folder || folder.tenantId !== tenantId) {
      throw new NotFoundException('La carpeta documental no existe.');
    }

    if (folder.companyId) {
      assertCompanyAccess(actor, folder.companyId);
    }

    const nextCompanyId =
      dto.companyId !== undefined
        ? this.toOptionalString(dto.companyId)
        : folder.companyId;

    if (nextCompanyId) {
      assertCompanyAccess(actor, nextCompanyId);
    }

    const nextName =
      dto.name !== undefined ? this.normalizeFolderName(dto.name) : folder.name;

    const updated = await this.prisma.documentFolder.update({
      where: { id: folder.id },
      data: {
        ...(dto.name !== undefined
          ? {
              name: nextName,
              slug: await this.uniqueFolderSlug(tenantId, nextName, folder.id),
            }
          : {}),
        ...(dto.companyId !== undefined ? { companyId: nextCompanyId } : {}),
        ...(dto.description !== undefined
          ? { description: this.toOptionalString(dto.description) }
          : {}),
        ...(dto.type !== undefined
          ? {
              type:
                dto.type === null ? null : this.normalizeDocumentType(dto.type),
            }
          : {}),
        ...(dto.visibleToEmployee !== undefined
          ? { visibleToEmployee: Boolean(dto.visibleToEmployee) }
          : {}),
        ...(dto.requiresSignature !== undefined
          ? { requiresSignature: Boolean(dto.requiresSignature) }
          : {}),
        ...(dto.allowMultiple !== undefined
          ? { allowMultiple: Boolean(dto.allowMultiple) }
          : {}),
        ...(dto.retentionYears !== undefined
          ? {
              retentionYears: this.normalizeOptionalPositiveInt(
                dto.retentionYears,
              ),
            }
          : {}),
        ...(dto.status !== undefined
          ? { status: this.normalizeOrganizationStatus(dto.status) }
          : {}),
      },
      select: this.folderSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updated.company?.id ?? null,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'document_folder.updated',
      entityType: 'DocumentFolder',
      entityId: updated.id,
      summary: `Se actualizo la carpeta documental ${updated.name}.`,
      before: this.toJson(folder),
      after: this.toJson(updated),
    });

    return updated;
  }

  async deleteFolder(actor: AuthUser, folderId: string) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(folderId);

    if (!id) {
      throw new BadRequestException('La carpeta es obligatoria.');
    }

    const folder = await this.prisma.documentFolder.findUnique({
      where: { id },
      select: {
        ...this.folderWithTenantSelect(),
        _count: { select: { documents: true } },
      },
    });

    if (!folder || folder.tenantId !== tenantId) {
      throw new NotFoundException('La carpeta documental no existe.');
    }

    if (folder.companyId) {
      assertCompanyAccess(actor, folder.companyId);
    }

    if (folder._count.documents > 0) {
      throw new BadRequestException(
        'No puedes eliminar una carpeta con documentos. Cambiala a inactiva o mueve los documentos primero.',
      );
    }

    await this.prisma.documentFolder.delete({ where: { id: folder.id } });

    await this.auditService.write({
      tenantId,
      companyId: folder.companyId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'document_folder.deleted',
      entityType: 'DocumentFolder',
      entityId: folder.id,
      summary: `Se elimino la carpeta documental ${folder.name}.`,
      before: this.toJson(folder),
    });

    return { deleted: true, id: folder.id };
  }

  async create(actor: AuthUser, createDocumentDto: CreateDocumentDto) {
    const tenantId = actor.tenantId;
    const employeeIds = this.normalizeEmployeeIds(createDocumentDto);
    const title = this.toOptionalString(createDocumentDto.title);

    if (employeeIds.length === 0 || !title) {
      throw new BadRequestException('Trabajador y titulo son obligatorios.');
    }

    const folder = await this.resolveFolder(actor, createDocumentDto);
    const type = createDocumentDto.type
      ? this.normalizeDocumentType(createDocumentDto.type)
      : (folder?.type ?? DocumentType.OTHER);
    const requiresSignature =
      createDocumentDto.requiresSignature ?? folder?.requiresSignature ?? false;
    const status = this.normalizeDocumentStatus(
      createDocumentDto.status ??
        (requiresSignature
          ? DocumentStatus.PENDING_SIGNATURE
          : DocumentStatus.DRAFT),
    );

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        status: true,
        firstName: true,
        lastName: true,
      },
    });

    if (employees.length !== employeeIds.length) {
      throw new BadRequestException(
        'Uno o mas trabajadores seleccionados no existen.',
      );
    }

    for (const employee of employees) {
      if (employee.tenantId !== tenantId || employee.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Solo puedes asignar documentos a trabajadores activos.',
        );
      }
      assertCompanyAccess(actor, employee.companyId);
    }

    const issuedAt = this.parseOptionalDate(createDocumentDto.issuedAt);
    const expiresAt = this.parseOptionalDate(createDocumentDto.expiresAt);
    const normalizedFolder =
      folder?.name ?? this.normalizeFolder(createDocumentDto.folder);

    const createdDocuments = await this.prisma.$transaction(
      employees.map((employee) =>
        this.prisma.employeeDocument.create({
          data: {
            tenantId: employee.tenantId,
            companyId: employee.companyId,
            employeeId: employee.id,
            folderId: folder?.id ?? null,
            type,
            status,
            title,
            folder: normalizedFolder,
            fileUrl: this.toOptionalString(createDocumentDto.fileUrl),
            fileName: this.toOptionalString(createDocumentDto.fileName),
            mimeType: this.toOptionalString(createDocumentDto.mimeType),
            fileSize: this.normalizeOptionalPositiveInt(
              createDocumentDto.fileSize,
            ),
            visibleToEmployee:
              createDocumentDto.visibleToEmployee ??
              folder?.visibleToEmployee ??
              true,
            requiresSignature,
            notes: this.toOptionalString(createDocumentDto.notes),
            issuedAt,
            expiresAt,
          },
          select: this.documentSelect(),
        }),
      ),
    );

    for (const document of createdDocuments) {
      await this.auditService.write({
        tenantId,
        companyId: document.company.id,
        actorType: 'user',
        actorLabel: this.actorLabel(actor),
        action: 'document.created',
        entityType: 'EmployeeDocument',
        entityId: document.id,
        summary: `Se creo el documento ${document.title}.`,
        after: this.toJson(this.auditDocumentSnapshot(document)),
      });
    }

    return createdDocuments.length === 1
      ? createdDocuments[0]
      : { count: createdDocuments.length, data: createdDocuments };
  }

  async update(
    actor: AuthUser,
    documentId: string,
    updateDocumentDto: UpdateDocumentDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(documentId);
    const title = this.toOptionalString(updateDocumentDto.title);
    const employeeId = this.toOptionalString(updateDocumentDto.employeeId);

    if (!id) {
      throw new BadRequestException('El documento es obligatorio.');
    }

    const document = await this.prisma.employeeDocument.findUnique({
      where: { id },
      select: this.documentWithTenantSelect(),
    });

    if (!document || document.tenantId !== tenantId) {
      throw new BadRequestException('El documento seleccionado no existe.');
    }

    assertCompanyAccess(actor, document.company.id);

    let targetEmployee: {
      id: string;
      tenantId: string;
      companyId: string;
      status: string;
    } | null = null;
    const folder =
      updateDocumentDto.folderId !== undefined ||
      updateDocumentDto.folder !== undefined
        ? await this.resolveFolder(actor, updateDocumentDto)
        : undefined;

    if (employeeId && employeeId !== document.employee.id) {
      targetEmployee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          tenantId: true,
          companyId: true,
          status: true,
        },
      });

      if (
        !targetEmployee ||
        targetEmployee.tenantId !== tenantId ||
        targetEmployee.status !== 'ACTIVE'
      ) {
        throw new BadRequestException(
          'El trabajador seleccionado no existe o no esta activo.',
        );
      }

      assertCompanyAccess(actor, targetEmployee.companyId);
    }

    const updatedDocument = await this.prisma.employeeDocument.update({
      where: { id: document.id },
      data: {
        ...(targetEmployee
          ? {
              employeeId: targetEmployee.id,
              companyId: targetEmployee.companyId,
            }
          : {}),
        ...(updateDocumentDto.type !== undefined
          ? { type: this.normalizeDocumentType(updateDocumentDto.type) }
          : {}),
        ...(updateDocumentDto.status !== undefined
          ? { status: this.normalizeDocumentStatus(updateDocumentDto.status) }
          : {}),
        ...(title ? { title } : {}),
        ...(updateDocumentDto.folder !== undefined
          ? {
              folder:
                folder?.name ?? this.normalizeFolder(updateDocumentDto.folder),
            }
          : {}),
        ...(updateDocumentDto.folderId !== undefined
          ? { folderId: folder?.id ?? null }
          : {}),
        ...(updateDocumentDto.fileUrl !== undefined
          ? { fileUrl: this.toOptionalString(updateDocumentDto.fileUrl) }
          : {}),
        ...(updateDocumentDto.fileName !== undefined
          ? { fileName: this.toOptionalString(updateDocumentDto.fileName) }
          : {}),
        ...(updateDocumentDto.mimeType !== undefined
          ? { mimeType: this.toOptionalString(updateDocumentDto.mimeType) }
          : {}),
        ...(updateDocumentDto.fileSize !== undefined
          ? {
              fileSize: this.normalizeOptionalPositiveInt(
                updateDocumentDto.fileSize,
              ),
            }
          : {}),
        ...(updateDocumentDto.visibleToEmployee !== undefined
          ? { visibleToEmployee: Boolean(updateDocumentDto.visibleToEmployee) }
          : {}),
        ...(updateDocumentDto.requiresSignature !== undefined
          ? { requiresSignature: Boolean(updateDocumentDto.requiresSignature) }
          : {}),
        ...(updateDocumentDto.notes !== undefined
          ? { notes: this.toOptionalString(updateDocumentDto.notes) }
          : {}),
        ...(updateDocumentDto.issuedAt !== undefined
          ? { issuedAt: this.parseOptionalDate(updateDocumentDto.issuedAt) }
          : {}),
        ...(updateDocumentDto.expiresAt !== undefined
          ? { expiresAt: this.parseOptionalDate(updateDocumentDto.expiresAt) }
          : {}),
      },
      select: this.documentSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updatedDocument.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'document.updated',
      entityType: 'EmployeeDocument',
      entityId: updatedDocument.id,
      summary: `Se actualizo el documento ${updatedDocument.title}.`,
      before: this.toJson(this.auditDocumentSnapshot(document)),
      after: this.toJson(this.auditDocumentSnapshot(updatedDocument)),
    });

    return updatedDocument;
  }

  async remove(actor: AuthUser, documentId: string) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(documentId);

    if (!id) {
      throw new BadRequestException('El documento es obligatorio.');
    }

    const document = await this.prisma.employeeDocument.findUnique({
      where: { id },
      select: this.documentWithTenantSelect(),
    });

    if (!document || document.tenantId !== tenantId) {
      throw new BadRequestException('El documento seleccionado no existe.');
    }

    assertCompanyAccess(actor, document.company.id);

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: {
          tenantId,
          OR: [
            { entityType: 'EmployeeDocument', entityId: document.id },
            {
              ruleKey: {
                in: [
                  `document-expired:${document.id}`,
                  `document-expiring:${document.id}`,
                  `document-signature:${document.id}`,
                ],
              },
            },
          ],
        },
      }),
      this.prisma.employeeDocument.delete({ where: { id: document.id } }),
    ]);

    await this.auditService.write({
      tenantId,
      companyId: document.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'document.deleted',
      entityType: 'EmployeeDocument',
      entityId: document.id,
      summary: `Se elimino el documento ${document.title}.`,
      before: this.toJson(this.auditDocumentSnapshot(document)),
    });

    return { id: document.id, deleted: true };
  }

  async exportZip(
    actor: AuthUser,
    response: Response,
    filters?: {
      companyId?: string;
      employeeId?: string;
      folderId?: string;
      status?: string;
      type?: string;
    },
  ) {
    const tenantId = actor.tenantId;
    const where: Prisma.EmployeeDocumentWhereInput = {
      tenantId,
      employee: employeeVisibilityScope(actor),
      fileUrl: { not: null },
    };

    const companyId = this.toOptionalString(filters?.companyId);
    const employeeId = this.toOptionalString(filters?.employeeId);
    const folderId = this.toOptionalString(filters?.folderId);
    const status = this.normalizeOptionalDocumentStatus(filters?.status);
    const type = this.normalizeOptionalDocumentType(filters?.type);

    if (companyId) {
      assertCompanyAccess(actor, companyId);
      where.companyId = companyId;
    } else if (!hasGlobalCompanyAccess(actor)) {
      if (!actor.companyId) {
        throw new BadRequestException('Tu usuario no tiene empresa asignada.');
      }

      where.companyId = actor.companyId;
    }

    if (employeeId) where.employeeId = employeeId;
    if (folderId) where.folderId = folderId;
    if (status) where.status = status;
    if (type) where.type = type;

    const documents = await this.prisma.employeeDocument.findMany({
      where,
      orderBy: [
        { folder: 'asc' },
        { employee: { firstName: 'asc' } },
        { employee: { lastName: 'asc' } },
        { createdAt: 'desc' },
      ],
      take: 5000,
      select: {
        id: true,
        title: true,
        folder: true,
        fileUrl: true,
        fileName: true,
        createdAt: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            documentNumber: true,
            employeeCode: true,
          },
        },
      },
    });

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="documentos-spulso-${Date.now()}.zip"`,
    );

    const { ZipArchive } = await import('archiver');
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (error) => {
      throw error;
    });
    archive.pipe(response);

    const manifest: Array<Record<string, string | null>> = [];

    for (const document of documents) {
      const filePath = resolveLocalDocumentUploadPath(document.fileUrl);
      if (!filePath || !existsSync(filePath)) {
        continue;
      }

      const employeeFolder = this.safeArchiveSegment(
        `${document.employee.firstName} ${document.employee.lastName}`,
      );
      const folder = this.safeArchiveSegment(document.folder || 'General');
      const extension = this.extensionFromFileName(
        document.fileName ?? document.fileUrl ?? document.title,
      );
      const fileName = `${this.safeArchiveSegment(document.title)}-${document.id.slice(0, 8)}${extension}`;

      archive.append(createReadStream(filePath), {
        name: `${folder}/${employeeFolder}/${fileName}`,
      });
      manifest.push({
        id: document.id,
        title: document.title,
        folder: document.folder,
        employee: `${document.employee.firstName} ${document.employee.lastName}`,
        documentNumber: document.employee.documentNumber,
        employeeCode: document.employee.employeeCode,
      });
    }

    archive.append(JSON.stringify(manifest, null, 2), {
      name: 'manifest.json',
    });

    await archive.finalize();

    await this.auditService.write({
      tenantId,
      companyId: companyId ?? null,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'document_archive.exported',
      entityType: 'EmployeeDocument',
      entityId: 'bulk',
      summary: `Se exporto un ZIP con ${manifest.length} documentos.`,
      after: this.toJson({ count: manifest.length, filters }),
    });
  }

  private documentSelect() {
    return {
      id: true,
      type: true,
      status: true,
      title: true,
      folder: true,
      fileUrl: true,
      issuedAt: true,
      expiresAt: true,
      signedAt: true,
      signedByName: true,
      signedByEmail: true,
      signatureText: true,
      visibleToEmployee: true,
      requiresSignature: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      notes: true,
      folderRef: {
        select: {
          id: true,
          name: true,
          slug: true,
          visibleToEmployee: true,
          requiresSignature: true,
        },
      },
      createdAt: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    };
  }

  private documentWithTenantSelect() {
    return {
      id: true,
      tenantId: true,
      type: true,
      status: true,
      title: true,
      folder: true,
      fileUrl: true,
      issuedAt: true,
      expiresAt: true,
      signedAt: true,
      signedByName: true,
      signedByEmail: true,
      signatureText: true,
      visibleToEmployee: true,
      requiresSignature: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      notes: true,
      folderRef: {
        select: {
          id: true,
          name: true,
          slug: true,
          visibleToEmployee: true,
          requiresSignature: true,
        },
      },
      createdAt: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    };
  }

  private actorLabel(actor: AuthUser) {
    return actor.email;
  }

  private auditDocumentSnapshot(document: {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    title: string;
    folder: string;
    fileUrl: string | null;
    visibleToEmployee?: boolean;
    requiresSignature?: boolean;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
    notes?: string | null;
    issuedAt: Date | string | null;
    expiresAt: Date | string | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    };
    company: { id: string; name: string; slug: string };
  }) {
    return {
      id: document.id,
      title: document.title,
      folder: document.folder,
      type: document.type,
      status: document.status,
      fileUrl: document.fileUrl,
      visibleToEmployee: document.visibleToEmployee ?? true,
      requiresSignature: document.requiresSignature ?? false,
      fileName: document.fileName ?? null,
      issuedAt: document.issuedAt
        ? new Date(document.issuedAt).toISOString().slice(0, 10)
        : null,
      expiresAt: document.expiresAt
        ? new Date(document.expiresAt).toISOString().slice(0, 10)
        : null,
      employee: {
        id: document.employee.id,
        name: `${document.employee.firstName} ${document.employee.lastName}`,
      },
      company: {
        id: document.company.id,
        name: document.company.name,
      },
    };
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private normalizeDocumentType(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized || !(normalized in DocumentType)) {
      throw new BadRequestException('El tipo de documento no es valido.');
    }

    return DocumentType[normalized as keyof typeof DocumentType];
  }

  private normalizeDocumentStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized || !(normalized in DocumentStatus)) {
      throw new BadRequestException('El estado de documento no es valido.');
    }

    return DocumentStatus[normalized as keyof typeof DocumentStatus];
  }

  private normalizeFolder(value: unknown) {
    const normalized = this.toOptionalString(value) ?? 'General';
    const compact = normalized.replace(/\s+/g, ' ').trim();

    if (compact.length < 2 || compact.length > 60) {
      throw new BadRequestException(
        'La carpeta debe tener entre 2 y 60 caracteres.',
      );
    }

    return compact;
  }

  private normalizeFolderName(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      throw new BadRequestException('El nombre de carpeta es obligatorio.');
    }

    return this.normalizeFolder(normalized);
  }

  private normalizeEmployeeIds(dto: CreateDocumentDto) {
    const values = [
      ...((Array.isArray(dto.employeeIds) ? dto.employeeIds : []) as unknown[]),
      dto.employeeId,
    ]
      .map((value) => this.toOptionalString(value))
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set(values));
  }

  private async resolveFolder(
    actor: AuthUser,
    dto: { folderId?: string | null; folder?: string | null },
  ) {
    const folderId = this.toOptionalString(dto.folderId);

    if (folderId) {
      const folder = await this.prisma.documentFolder.findUnique({
        where: { id: folderId },
        select: this.folderWithTenantSelect(),
      });

      if (!folder || folder.tenantId !== actor.tenantId) {
        throw new BadRequestException('La carpeta documental no existe.');
      }

      if (folder.companyId) {
        assertCompanyAccess(actor, folder.companyId);
      }

      return folder;
    }

    const folderName = this.toOptionalString(dto.folder);
    if (!folderName) {
      return null;
    }

    const normalizedName = this.normalizeFolder(folderName);
    const slug = this.slugify(normalizedName);

    return this.prisma.documentFolder.upsert({
      where: { tenantId_slug: { tenantId: actor.tenantId, slug } },
      update: {},
      create: {
        tenantId: actor.tenantId,
        name: normalizedName,
        slug,
        sortOrder: await this.nextFolderSortOrder(actor.tenantId),
      },
      select: this.folderWithTenantSelect(),
    });
  }

  private folderSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      type: true,
      status: true,
      visibleToEmployee: true,
      requiresSignature: true,
      allowMultiple: true,
      retentionYears: true,
      sortOrder: true,
      company: { select: { id: true, name: true, slug: true } },
      _count: { select: { documents: true } },
    };
  }

  private folderWithTenantSelect() {
    return {
      id: true,
      tenantId: true,
      companyId: true,
      name: true,
      slug: true,
      description: true,
      type: true,
      status: true,
      visibleToEmployee: true,
      requiresSignature: true,
      allowMultiple: true,
      retentionYears: true,
      sortOrder: true,
      company: { select: { id: true, name: true, slug: true } },
    };
  }

  private async ensureDefaultFolders(tenantId: string) {
    const count = await this.prisma.documentFolder.count({
      where: { tenantId },
    });
    if (count > 0) return;

    const defaults: Array<{
      name: string;
      slug: string;
      description: string;
      type: DocumentType;
      visibleToEmployee: boolean;
      requiresSignature: boolean;
      sortOrder: number;
    }> = [
      {
        name: 'Boletas',
        slug: 'boletas',
        description: 'Pagos mensuales y constancias remunerativas.',
        type: DocumentType.PAYSLIP,
        visibleToEmployee: true,
        requiresSignature: false,
        sortOrder: 10,
      },
      {
        name: 'Contratos',
        slug: 'contratos',
        description: 'Contratos laborales y acuerdos principales.',
        type: DocumentType.CONTRACT,
        visibleToEmployee: true,
        requiresSignature: true,
        sortOrder: 20,
      },
      {
        name: 'Adendas',
        slug: 'adendas',
        description: 'Cambios contractuales, anexos y renovaciones.',
        type: DocumentType.CONTRACT,
        visibleToEmployee: true,
        requiresSignature: true,
        sortOrder: 30,
      },
      {
        name: 'Suspensiones y sanciones',
        slug: 'suspensiones-y-sanciones',
        description: 'Medidas disciplinarias y cartas de sancion.',
        type: DocumentType.OTHER,
        visibleToEmployee: true,
        requiresSignature: true,
        sortOrder: 40,
      },
      {
        name: 'Interno RRHH',
        slug: 'interno-rrhh',
        description: 'Documentos privados visibles solo para RRHH.',
        type: DocumentType.OTHER,
        visibleToEmployee: false,
        requiresSignature: false,
        sortOrder: 90,
      },
    ];

    await this.prisma.documentFolder.createMany({
      data: defaults.map((folder) => ({ ...folder, tenantId })),
      skipDuplicates: true,
    });
  }

  private async uniqueFolderSlug(
    tenantId: string,
    name: string,
    ignoreId?: string,
  ) {
    const base = this.slugify(name);
    let slug = base;
    let index = 2;

    while (
      await this.prisma.documentFolder.findFirst({
        where: {
          tenantId,
          slug,
          ...(ignoreId ? { id: { not: ignoreId } } : {}),
        },
        select: { id: true },
      })
    ) {
      slug = `${base}-${index}`;
      index += 1;
    }

    return slug;
  }

  private async nextFolderSortOrder(tenantId: string) {
    const aggregate = await this.prisma.documentFolder.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });

    return (aggregate._max.sortOrder ?? 0) + 10;
  }

  private slugify(value: string) {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'carpeta';
  }

  private normalizeOrganizationStatus(value: unknown) {
    const normalized = this.toOptionalString(value);
    if (!normalized || !(normalized in OrganizationStatus)) {
      throw new BadRequestException('El estado de carpeta no es valido.');
    }
    return OrganizationStatus[normalized as keyof typeof OrganizationStatus];
  }

  private normalizeOptionalPositiveInt(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
      throw new BadRequestException('El valor numerico enviado no es valido.');
    }
    return number;
  }

  private safeArchiveSegment(value: string) {
    return (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._ -]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'documento'
    );
  }

  private extensionFromFileName(value: string) {
    const name = basename(value);
    const match = name.match(/\.[a-zA-Z0-9]{2,8}$/);
    return match ? match[0].toLowerCase() : '.pdf';
  }

  private normalizeOptionalDocumentType(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in DocumentType)) {
      throw new BadRequestException('El tipo de documento no es valido.');
    }

    return DocumentType[normalized as keyof typeof DocumentType];
  }

  private normalizeOptionalDocumentStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in DocumentStatus)) {
      throw new BadRequestException('El estado de documento no es valido.');
    }

    return DocumentStatus[normalized as keyof typeof DocumentStatus];
  }

  private getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return today;
  }

  private parseOptionalDate(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha enviada no es valida.');
    }

    return date;
  }

  private parseOptionalFilterDate(value: unknown, boundary: 'start' | 'end') {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha enviada no es valida.');
    }

    if (boundary === 'start') {
      date.setHours(0, 0, 0, 0);
    } else {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }

  private normalizePage(value: unknown) {
    const page = Number(value ?? 1);

    if (!Number.isInteger(page) || page < 1) {
      return 1;
    }

    return page;
  }

  private normalizePageSize(value: unknown) {
    const pageSize = Number(value ?? 10);

    if (!Number.isInteger(pageSize)) {
      return 10;
    }

    return Math.min(Math.max(pageSize, 5), 100);
  }

  private toOptionalString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      return null;
    }

    const normalized = String(value).trim();

    return normalized.length > 0 ? normalized : null;
  }
}

export function resolveLocalDocumentUploadPath(
  fileUrl: string | null | undefined,
  workingDirectory = process.cwd(),
) {
  const normalizedUrl = fileUrl?.trim();
  if (!normalizedUrl?.startsWith('/uploads/documentos/')) {
    return null;
  }

  const relative = normalizedUrl.replace(/^\/uploads\//, '');
  const root = resolve(workingDirectory, 'uploads');
  const absolutePath = resolve(root, relative);

  return absolutePath.startsWith(`${root}${sep}`) ? absolutePath : null;
}
