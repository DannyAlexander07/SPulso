import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { createReadStream } from 'fs';
import { diskStorage } from 'multer';
import { basename, extname, join, resolve, sep } from 'path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'fs';
import type { Request, Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import {
  assertCompanyAccess,
  employeeVisibilityScope,
} from '../auth/access-scope';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedDocumentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const uploadRoot = join(process.cwd(), 'uploads', 'comunicados');
const userUploadRoot = join(process.cwd(), 'uploads', 'usuarios');
const documentUploadRoot = join(process.cwd(), 'uploads', 'documentos');
const userImageMaxSize = 5 * 1024 * 1024;
const documentMaxSize = 25 * 1024 * 1024;
const documentUploadUserQuota = 2 * 1024 * 1024 * 1024;
const documentUploadTenantQuota = 20 * 1024 * 1024 * 1024;

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(['uploads/:category/:filename'])
  async readProtectedFile(
    @CurrentUser() user: AuthUser,
    @Param('category') category: string,
    @Param('filename') filename: string,
    @Res() response: Response,
  ) {
    const safeCategory = this.requireMediaCategory(category);
    const safeFileName = this.requireFileName(filename);
    const fileUrl = `/uploads/${safeCategory}/${safeFileName}`;

    await this.assertMediaAccess(user, safeCategory, fileUrl);

    const categoryRoot = resolve(process.cwd(), 'uploads', safeCategory);
    const absolutePath = resolve(categoryRoot, safeFileName);

    if (
      !absolutePath.startsWith(`${categoryRoot}${sep}`) ||
      !existsSync(absolutePath)
    ) {
      throw new NotFoundException('El archivo no existe.');
    }

    const stats = statSync(absolutePath);
    if (!stats.isFile()) {
      throw new NotFoundException('El archivo no existe.');
    }

    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('Content-Length', stats.size);
    response.setHeader('Content-Type', mimeTypeFromFileName(safeFileName));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return createReadStream(absolutePath).pipe(response);
  }

  @Post(['archivos/comunicados', 'files/announcements'])
  @Permissions('announcements.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 3 * 1024 * 1024 },
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          mkdirSync(uploadRoot, { recursive: true });
          callback(null, uploadRoot);
        },
        filename: (request, file, callback) => {
          const user = (request as Request & { user?: AuthUser }).user;
          if (!user?.tenantId || !user.sub) {
            callback(new Error('Sesion requerida.'), '');
            return;
          }
          const extension = safeExtension(file.mimetype);
          const name = `${user.tenantId}--${user.sub}--${Date.now()}-${randomSuffix()}${extension}`;
          callback(null, name);
        },
      }),
      fileFilter: (_request, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              'Solo se permiten imagenes JPG, PNG o WebP.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadAnnouncementImage(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona una imagen para subir.');
    }

    if (!hasValidImageSignature(file.path, file.mimetype)) {
      unlinkSync(file.path);
      throw new BadRequestException(
        'La imagen no coincide con un archivo JPG, PNG o WebP valido.',
      );
    }

    return {
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/comunicados/${file.filename}`,
    };
  }

  @Post(['archivos/usuarios', 'files/users'])
  @Permissions('users.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: userImageMaxSize },
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          mkdirSync(userUploadRoot, { recursive: true });
          callback(null, userUploadRoot);
        },
        filename: (request, file, callback) => {
          const user = (request as Request & { user?: AuthUser }).user;
          if (!user?.tenantId || !user.sub) {
            callback(new Error('Sesion requerida.'), '');
            return;
          }
          const extension = safeExtension(file.mimetype);
          const name = `${user.tenantId}--${user.sub}--${Date.now()}-${randomSuffix()}${extension}`;
          callback(null, name);
        },
      }),
      fileFilter: (_request, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              'Solo se permiten imagenes JPG, PNG o WebP.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadUserImage(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona una imagen para subir.');
    }

    if (!hasValidImageSignature(file.path, file.mimetype)) {
      unlinkSync(file.path);
      throw new BadRequestException(
        'La imagen no coincide con un archivo JPG, PNG o WebP valido.',
      );
    }

    return {
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/usuarios/${file.filename}`,
    };
  }

  @Post(['archivos/documentos', 'files/documents'])
  @Permissions('documents.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: documentMaxSize },
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          mkdirSync(documentUploadRoot, { recursive: true });
          callback(null, documentUploadRoot);
        },
        filename: (request, file, callback) => {
          const user = (request as Request & { user?: AuthUser }).user;
          if (!user?.tenantId) {
            callback(new Error('Sesion requerida.'), '');
            return;
          }
          const extension = safeDocumentExtension(file.mimetype);
          const name = `${user.tenantId}--${user.sub}--${Date.now()}-${randomSuffix()}${extension}`;
          callback(null, name);
        },
      }),
      fileFilter: (_request, file, callback) => {
        if (!allowedDocumentMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              'Solo se permiten PDF o imagenes JPG, PNG y WebP.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadDocumentFile(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona un archivo para subir.');
    }

    if (!hasValidDocumentSignature(file.path, file.mimetype)) {
      unlinkSync(file.path);
      throw new BadRequestException(
        'El archivo no coincide con un PDF o imagen valida.',
      );
    }

    try {
      this.assertDocumentUploadQuota(actor);
    } catch (error) {
      unlinkSync(file.path);
      throw error;
    }

    return {
      fileName: safeDisplayFileName(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/documentos/${file.filename}`,
    };
  }

  private assertDocumentUploadQuota(actor: AuthUser) {
    const tenantPrefix = `${actor.tenantId}--`;
    const userPrefix = `${actor.tenantId}--${actor.sub}--`;
    let tenantBytes = 0;
    let userBytes = 0;

    for (const fileName of readdirSync(documentUploadRoot)) {
      if (!fileName.startsWith(tenantPrefix)) continue;
      const filePath = join(documentUploadRoot, fileName);
      const stats = statSync(filePath);
      if (!stats.isFile()) continue;
      tenantBytes += stats.size;
      if (fileName.startsWith(userPrefix)) userBytes += stats.size;
    }

    if (
      userBytes > documentUploadUserQuota ||
      tenantBytes > documentUploadTenantQuota
    ) {
      throw new ForbiddenException(
        'Se alcanzo la cuota segura de archivos documentales. Elimina cargas no utilizadas o solicita una ampliacion controlada.',
      );
    }
  }

  private async assertMediaAccess(
    actor: AuthUser,
    category: 'comunicados' | 'documentos' | 'usuarios',
    fileUrl: string,
  ) {
    const permissions = actor.permissions ?? [];

    if (category === 'documentos') {
      const document = await this.prisma.employeeDocument.findFirst({
        where: {
          fileUrl,
          tenantId: actor.tenantId,
          employee: employeeVisibilityScope(actor),
        },
        select: {
          companyId: true,
          employeeId: true,
          tenantId: true,
          visibleToEmployee: true,
        },
      });

      if (!document) {
        this.requireOwnedPendingUpload(
          actor,
          fileUrl,
          'documentos',
          'documents.manage',
        );
        return;
      }

      if (
        document.visibleToEmployee &&
        actor.employeeId === document.employeeId
      ) {
        return;
      }

      if (
        !permissions.includes('documents.manage') &&
        !permissions.includes('employees.view')
      ) {
        throw new ForbiddenException('No tienes acceso a este archivo.');
      }

      this.requirePermission(permissions, 'documents.view');
      assertCompanyAccess(actor, document.companyId);
      return;
    }

    if (category === 'usuarios') {
      const owner = await this.prisma.user.findFirst({
        where: { avatarUrl: fileUrl },
        select: { companyId: true, id: true, tenantId: true },
      });

      if (!owner) {
        this.requireOwnedPendingUpload(
          actor,
          fileUrl,
          'usuarios',
          'users.manage',
        );
        return;
      }

      if (owner.tenantId !== actor.tenantId) {
        throw new NotFoundException('El archivo no existe.');
      }

      if (owner.id === actor.sub) return;

      if (
        !permissions.includes('users.manage') &&
        !permissions.includes('employees.view')
      ) {
        throw new ForbiddenException('No tienes acceso a este archivo.');
      }

      assertCompanyAccess(actor, owner.companyId);
      return;
    }

    const announcement = await this.prisma.announcement.findFirst({
      where: { imageUrl: fileUrl },
      select: {
        audienceScope: true,
        audiences: {
          select: { companyId: true, employeeId: true, teamId: true },
        },
        tenantId: true,
      },
    });

    if (!announcement) {
      this.requireOwnedPendingUpload(
        actor,
        fileUrl,
        'comunicados',
        'announcements.manage',
      );
      return;
    }

    if (announcement.tenantId !== actor.tenantId) {
      throw new NotFoundException('El archivo no existe.');
    }

    if (permissions.includes('announcements.manage')) return;
    this.requirePermission(permissions, 'announcements.view');

    if (announcement.audienceScope === 'ALL') return;
    if (
      announcement.audienceScope === 'COMPANIES' &&
      announcement.audiences.some(
        (audience) => audience.companyId === actor.companyId,
      )
    ) {
      return;
    }
    if (
      announcement.audienceScope === 'EMPLOYEES' &&
      announcement.audiences.some(
        (audience) => audience.employeeId === actor.employeeId,
      )
    ) {
      return;
    }
    if (announcement.audienceScope === 'TEAMS' && actor.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: actor.employeeId },
        select: { teamId: true },
      });
      if (
        employee?.teamId &&
        announcement.audiences.some(
          (audience) => audience.teamId === employee.teamId,
        )
      ) {
        return;
      }
    }

    throw new ForbiddenException('No tienes acceso a este archivo.');
  }

  private requireOwnedPendingUpload(
    actor: AuthUser,
    fileUrl: string,
    category: 'comunicados' | 'documentos' | 'usuarios',
    permission: string,
  ) {
    this.requirePermission(actor.permissions ?? [], permission);
    const expectedPrefix = `/uploads/${category}/${actor.tenantId}--${actor.sub}--`;
    if (!fileUrl.startsWith(expectedPrefix)) {
      throw new NotFoundException('El archivo no existe.');
    }
  }

  private requirePermission(permissions: string[], permission: string) {
    if (!permissions.includes(permission)) {
      throw new ForbiddenException('No tienes acceso a este archivo.');
    }
  }

  private requireMediaCategory(value: string) {
    if (!['comunicados', 'documentos', 'usuarios'].includes(value)) {
      throw new NotFoundException('El archivo no existe.');
    }

    return value as 'comunicados' | 'documentos' | 'usuarios';
  }

  private requireFileName(value: string) {
    const normalized = basename(value);
    if (normalized !== value || !/^[A-Za-z0-9._-]{1,180}$/.test(normalized)) {
      throw new BadRequestException('El nombre del archivo no es valido.');
    }
    return normalized;
  }
}

function hasValidImageSignature(path: string, mimeType: string) {
  const bytes = readFileSync(path).subarray(0, 12);

  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === 'image/webp') {
    return (
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  return false;
}

function safeExtension(mimeType: string) {
  const extensionByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  return extensionByMime[mimeType] ?? '.bin';
}

function hasValidDocumentSignature(path: string, mimeType: string) {
  if (allowedMimeTypes.has(mimeType)) {
    return hasValidImageSignature(path, mimeType);
  }

  const file = readFileSync(path);
  const bytes = file.subarray(0, 8);

  if (mimeType === 'application/pdf') {
    const content = file
      .toString('latin1')
      .replace(/#([0-9a-f]{2})/gi, (_match, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
    return (
      bytes.toString('ascii', 0, 5) === '%PDF-' &&
      !/\/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|RichMedia)\b/i.test(
        content,
      ) &&
      !/\/S\s*\/JavaScript\b/i.test(content)
    );
  }

  return false;
}

function safeDocumentExtension(mimeType: string) {
  const extensionByMime: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  return extensionByMime[mimeType] ?? '.bin';
}

function randomSuffix() {
  return randomBytes(12).toString('hex');
}

function safeDisplayFileName(originalName: string) {
  const name = basename(originalName)
    .split('')
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
        ? ' '
        : character,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return name.length > 0 ? name.slice(0, 180) : 'documento';
}

function mimeTypeFromFileName(fileName: string) {
  const mimeTypes: Record<string, string> = {
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return (
    mimeTypes[extname(fileName).toLowerCase()] ?? 'application/octet-stream'
  );
}
