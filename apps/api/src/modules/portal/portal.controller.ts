import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { diskStorage } from 'multer';
import { mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortalAccessGuard } from '../auth/portal-access.guard';
import type { CreateRequestDto } from '../requests/dto/create-request.dto';
import { PortalService } from './portal.service';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const userUploadRoot = join(process.cwd(), 'uploads', 'usuarios');
const userImageMaxSize = 5 * 1024 * 1024;

@Controller()
@UseGuards(JwtAuthGuard, PortalAccessGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get(['portal/perfil', 'portal/profile'])
  getProfile(@CurrentUser() user: AuthUser) {
    return this.portalService.getProfile(user);
  }

  @Post(['portal/solicitudes', 'portal/requests'])
  createRequest(
    @CurrentUser() user: AuthUser,
    @Body() createRequestDto: Omit<CreateRequestDto, 'employeeId'>,
  ) {
    return this.portalService.createRequest(user, createRequestDto);
  }

  @Patch(['portal/documentos/:id/firmar', 'portal/documents/:id/sign'])
  signDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('signatureText') signatureText?: string,
    @Req()
    request?: Request,
  ) {
    return this.portalService.signDocument(user, id, signatureText, {
      // Express only trusts forwarded addresses according to TRUST_PROXY_HOPS.
      ip: request?.ip ?? null,
      userAgent: request?.headers['user-agent'] ?? null,
    });
  }

  @Patch(['portal/comunicados/:id/leido', 'portal/announcements/:id/read'])
  markAnnouncementAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.portalService.markAnnouncementAsRead(user, id);
  }

  @Patch(['portal/ficha', 'portal/profile'])
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body()
    updateProfileDto: {
      address?: string;
      personalEmail?: string;
      phoneMobile?: string;
    },
  ) {
    return this.portalService.updateProfile(user, updateProfileDto);
  }

  @Post(['portal/foto/archivo', 'portal/photo/file'])
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: userImageMaxSize },
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          mkdirSync(userUploadRoot, { recursive: true });
          callback(null, userUploadRoot);
        },
        filename: (_request, file, callback) => {
          const extension = safeExtension(file.mimetype);
          const name = `${Date.now()}-${randomSuffix()}${extension}`;
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
  uploadProfileImage(@UploadedFile() file: Express.Multer.File | undefined) {
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

  @Patch(['portal/foto', 'portal/photo'])
  updateProfilePhoto(
    @CurrentUser() user: AuthUser,
    @Body() updatePhotoDto: { avatarUrl?: string | null },
  ) {
    return this.portalService.updateProfilePhoto(
      user,
      updatePhotoDto.avatarUrl ?? null,
    );
  }
}

function hasValidImageSignature(path: string, mimeType: string) {
  const file = readFileSync(path);

  if (mimeType === 'image/jpeg') {
    return file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return (
      file[0] === 0x89 &&
      file[1] === 0x50 &&
      file[2] === 0x4e &&
      file[3] === 0x47
    );
  }

  if (mimeType === 'image/webp') {
    return (
      file[0] === 0x52 &&
      file[1] === 0x49 &&
      file[2] === 0x46 &&
      file[3] === 0x46 &&
      file[8] === 0x57 &&
      file[9] === 0x45 &&
      file[10] === 0x42 &&
      file[11] === 0x50
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

function randomSuffix() {
  return randomBytes(12).toString('hex');
}
