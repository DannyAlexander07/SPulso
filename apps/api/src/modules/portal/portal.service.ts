import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AnnouncementAudienceScope,
  AnnouncementStatus,
  BenefitAudienceScope,
  BenefitStatus,
  DocumentStatus,
  OrganizationStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { CreateRequestDto } from '../requests/dto/create-request.dto';
import { RequestsService } from '../requests/requests.service';

@Injectable()
export class PortalService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly requestsService: RequestsService,
  ) {}

  async getProfile(user: AuthUser) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        status: 'ACTIVE',
      },
      select: this.employeeSelect(),
    });

    if (!employee) {
      throw new BadRequestException(
        'Tu usuario aun no tiene una ficha de trabajador vinculada.',
      );
    }

    const now = new Date();
    const [
      attendance,
      documents,
      requests,
      benefits,
      announcements,
      teamMembers,
      birthdays,
    ] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { tenantId: user.tenantId, employeeId: employee.id },
        orderBy: { workDate: 'desc' },
        take: 5,
        select: {
          id: true,
          workDate: true,
          checkIn: true,
          checkOut: true,
          status: true,
          source: true,
        },
      }),
      this.prisma.employeeDocument.findMany({
        where: {
          tenantId: user.tenantId,
          employeeId: employee.id,
          visibleToEmployee: true,
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 80,
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          folder: true,
          visibleToEmployee: true,
          requiresSignature: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          issuedAt: true,
          expiresAt: true,
          signedAt: true,
          signedByName: true,
          signedByEmail: true,
          signatureText: true,
          signatureHash: true,
          createdAt: true,
          folderRef: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              requiresSignature: true,
            },
          },
        },
      }),
      this.prisma.employeeRequest.findMany({
        where: { tenantId: user.tenantId, employeeId: employee.id },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          description: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),
      this.prisma.benefit.findMany({
        where: {
          tenantId: user.tenantId,
          status: BenefitStatus.ACTIVE,
          OR: [
            { audienceScope: BenefitAudienceScope.ALL },
            { audiences: { some: { companyId: employee.company.id } } },
            ...(employee.team?.id
              ? [{ audiences: { some: { teamId: employee.team.id } } }]
              : []),
          ],
        },
        orderBy: [{ isHighlighted: 'desc' }, { updatedAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          audienceScope: true,
          startsAt: true,
          endsAt: true,
          actionLabel: true,
          actionUrl: true,
          imageUrl: true,
          isHighlighted: true,
        },
      }),
      this.prisma.announcement.findMany({
        where: {
          tenantId: user.tenantId,
          status: AnnouncementStatus.PUBLISHED,
          OR: [
            { audienceScope: AnnouncementAudienceScope.ALL },
            { audiences: { some: { companyId: employee.company.id } } },
            { audiences: { some: { employeeId: employee.id } } },
            ...(employee.team?.id
              ? [{ audiences: { some: { teamId: employee.team.id } } }]
              : []),
          ],
          AND: [
            { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
          ],
        },
        orderBy: [
          { isPinned: 'desc' },
          { priority: 'desc' },
          { publishAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: 8,
        select: {
          id: true,
          title: true,
          message: true,
          imageUrl: true,
          priority: true,
          audienceScope: true,
          publishAt: true,
          expiresAt: true,
          isPinned: true,
          reads: {
            where: { employeeId: employee.id },
            select: { readAt: true },
            take: 1,
          },
        },
      }),
      employee.team?.id
        ? this.prisma.employee.findMany({
            where: {
              tenantId: user.tenantId,
              teamId: employee.team.id,
              status: 'ACTIVE',
              id: { not: employee.id },
            },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
            take: 80,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              personalEmail: true,
              phoneMobile: true,
              jobTitle: true,
              position: { select: { id: true, name: true } },
              areaRef: { select: { id: true, name: true } },
              company: { select: { id: true, name: true, slug: true } },
            },
          })
        : Promise.resolve([]),
      this.prisma.employee.findMany({
        where: {
          tenantId: user.tenantId,
          companyId: employee.company.id,
          status: 'ACTIVE',
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          company: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return {
      themePreference: user.themePreference ?? 'light',
      employee,
      attendance,
      documents,
      requests,
      benefits,
      announcements: announcements.map((announcement) => ({
        ...announcement,
        readAt: announcement.reads[0]?.readAt ?? null,
        reads: undefined,
      })),
      teamMembers,
      birthdays,
      summary: {
        pendingRequests: requests.filter(
          (request) => request.status === 'PENDING',
        ).length,
        documentsToSign: documents.filter(
          (document) => document.status === 'PENDING_SIGNATURE',
        ).length,
        benefits: benefits.length,
        announcements: announcements.length,
        teamMembers: teamMembers.length,
      },
    };
  }

  async createRequest(
    user: AuthUser,
    createRequestDto: Omit<CreateRequestDto, 'employeeId'>,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new BadRequestException(
        'Tu usuario aun no tiene una ficha de trabajador vinculada.',
      );
    }

    return this.requestsService.create(user, {
      ...createRequestDto,
      employeeId: employee.id,
    });
  }

  async markAnnouncementAsRead(user: AuthUser, id: string) {
    const announcementId = this.toOptionalString(id);

    if (!announcementId) {
      throw new BadRequestException('El comunicado es obligatorio.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        companyId: true,
        teamId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee) {
      throw new BadRequestException(
        'Tu usuario aun no tiene una ficha de trabajador vinculada.',
      );
    }

    const now = new Date();
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
        tenantId: user.tenantId,
        status: AnnouncementStatus.PUBLISHED,
        AND: [
          { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
        OR: [
          { audienceScope: AnnouncementAudienceScope.ALL },
          { audiences: { some: { companyId: employee.companyId } } },
          { audiences: { some: { employeeId: employee.id } } },
          ...(employee.teamId
            ? [{ audiences: { some: { teamId: employee.teamId } } }]
            : []),
        ],
      },
      select: { id: true, title: true },
    });

    if (!announcement) {
      throw new BadRequestException(
        'El comunicado seleccionado no esta disponible para tu usuario.',
      );
    }

    const read = await this.prisma.announcementRead.upsert({
      where: {
        announcementId_employeeId: {
          announcementId: announcement.id,
          employeeId: employee.id,
        },
      },
      update: {},
      create: {
        tenantId: user.tenantId,
        announcementId: announcement.id,
        employeeId: employee.id,
      },
      select: {
        id: true,
        announcementId: true,
        employeeId: true,
        readAt: true,
      },
    });

    await this.auditService.write({
      tenantId: user.tenantId,
      actorType: 'user',
      actorLabel: user.email,
      action: 'portal_announcement.read',
      entityType: 'Announcement',
      entityId: announcement.id,
      summary: `${employee.firstName} ${employee.lastName} marco como leido el comunicado ${announcement.title}.`,
      after: { readAt: read.readAt },
    });

    return read;
  }

  async signDocument(
    user: AuthUser,
    id: string,
    signatureText?: string,
    evidence?: { ip?: string | null; userAgent?: string | null },
  ) {
    const documentId = this.toOptionalString(id);

    if (!documentId) {
      throw new BadRequestException('El documento es obligatorio.');
    }

    const normalizedSignature = this.requireSignatureText(signatureText);

    const document = await this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        employeeId: true,
        status: true,
        visibleToEmployee: true,
        requiresSignature: true,
        title: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            personalEmail: true,
          },
        },
      },
    });

    if (!document || document.tenantId !== user.tenantId) {
      throw new BadRequestException('El documento seleccionado no existe.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    if (!employee || employee.id !== document.employeeId) {
      throw new BadRequestException(
        'No puedes firmar un documento de otro trabajador.',
      );
    }

    if (
      document.status !== DocumentStatus.PENDING_SIGNATURE ||
      !document.requiresSignature
    ) {
      throw new BadRequestException(
        'Este documento no esta pendiente de firma.',
      );
    }

    if (!document.visibleToEmployee) {
      throw new BadRequestException(
        'Este documento no esta visible en portal.',
      );
    }

    const signedAt = new Date();
    const signatureHash = createHash('sha256')
      .update(
        [
          document.id,
          document.employeeId,
          normalizedSignature,
          signedAt.toISOString(),
          evidence?.ip ?? '',
          evidence?.userAgent ?? '',
        ].join('|'),
      )
      .digest('hex');

    const signedDocument = await this.prisma.employeeDocument.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.SIGNED,
        signedAt,
        signedByName: `${document.employee.firstName} ${document.employee.lastName}`,
        signedByEmail: document.employee.personalEmail ?? user.email,
        signatureText: normalizedSignature,
        signatureIp: this.toOptionalString(evidence?.ip),
        signatureUserAgent: this.toOptionalString(evidence?.userAgent),
        signatureHash,
      },
      select: {
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
        signatureHash: true,
        createdAt: true,
      },
    });

    await this.auditService.write({
      tenantId: user.tenantId,
      companyId: document.companyId,
      actorType: 'user',
      actorLabel: user.email,
      action: 'portal_document.signed',
      entityType: 'EmployeeDocument',
      entityId: document.id,
      summary: `${document.employee.firstName} ${document.employee.lastName} firmo el documento ${document.title}.`,
      before: { status: DocumentStatus.PENDING_SIGNATURE },
      after: {
        status: DocumentStatus.SIGNED,
        signatureText: normalizedSignature,
        signatureHash,
      },
    });

    return signedDocument;
  }

  private requireSignatureText(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized || normalized.length < 4 || normalized.length > 120) {
      throw new BadRequestException(
        'Digita tu nombre o confirmacion de firma para continuar.',
      );
    }

    return normalized;
  }

  async updateProfile(
    user: AuthUser,
    updateProfileDto: {
      address?: string;
      personalEmail?: string;
      phoneMobile?: string;
    },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        personalEmail: true,
        phoneMobile: true,
        address: true,
      },
    });

    if (!employee) {
      throw new BadRequestException(
        'Tu usuario aun no tiene una ficha de trabajador vinculada.',
      );
    }

    const personalEmail = this.normalizeEmail(updateProfileDto.personalEmail);
    const phoneMobile = this.normalizePhone(updateProfileDto.phoneMobile);
    const address = this.toOptionalString(updateProfileDto.address);

    const updatedEmployee = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        personalEmail,
        phoneMobile,
        address,
      },
      select: this.employeeSelect(),
    });

    await this.auditService.write({
      tenantId: user.tenantId,
      companyId: employee.companyId,
      actorType: 'user',
      actorLabel: user.email,
      action: 'portal_profile.updated',
      entityType: 'Employee',
      entityId: employee.id,
      summary: 'El trabajador actualizo sus datos personales permitidos.',
      before: {
        personalEmail: employee.personalEmail,
        phoneMobile: employee.phoneMobile,
        address: employee.address,
      },
      after: {
        personalEmail: updatedEmployee.personalEmail,
        phoneMobile: updatedEmployee.phoneMobile,
        address: updatedEmployee.address,
      },
    });

    return updatedEmployee;
  }

  async updateProfilePhoto(user: AuthUser, avatarUrl: string | null) {
    const normalizedAvatarUrl = this.toOptionalUploadPath(avatarUrl);

    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!employee) {
      throw new BadRequestException(
        'Tu usuario aun no tiene una ficha de trabajador vinculada.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.sub },
      data: { avatarUrl: normalizedAvatarUrl },
      select: { id: true },
    });

    await this.auditService.write({
      tenantId: user.tenantId,
      companyId: null,
      actorType: 'user',
      actorLabel: user.email,
      action: 'portal.photo.updated',
      entityType: 'employee',
      entityId: employee.id,
      summary: 'Se actualizo la foto de perfil desde el portal trabajador.',
      after: { avatarUrl: normalizedAvatarUrl },
    });

    return { avatarUrl: normalizedAvatarUrl };
  }

  private employeeSelect() {
    return Prisma.validator<Prisma.EmployeeSelect>()({
      id: true,
      firstName: true,
      lastName: true,
      documentNumber: true,
      employeeCode: true,
      personalEmail: true,
      phoneMobile: true,
      address: true,
      jobTitle: true,
      area: true,
      hireDate: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      areaRef: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      position: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          area: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          leader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              personalEmail: true,
              phoneMobile: true,
              jobTitle: true,
              position: { select: { id: true, name: true } },
            },
          },
        },
      },
      clientAssignments: {
        where: { status: OrganizationStatus.ACTIVE },
        orderBy: [{ isPrimary: 'desc' }, { client: { name: 'asc' } }],
        select: {
          id: true,
          role: true,
          isPrimary: true,
          startsAt: true,
          endsAt: true,
          client: { select: { id: true, name: true, slug: true } },
          area: { select: { id: true, name: true, slug: true } },
          team: { select: { id: true, name: true, slug: true } },
        },
      },
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          personalEmail: true,
          phoneMobile: true,
          jobTitle: true,
          position: { select: { id: true, name: true } },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          avatarUrl: true,
        },
      },
    });
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

  private normalizeEmail(value: unknown) {
    const normalized = this.toOptionalString(value)?.toLowerCase() ?? null;

    if (!normalized) {
      return null;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException(
        'El correo personal no tiene un formato valido.',
      );
    }

    return normalized;
  }

  private normalizePhone(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    if (!/^[0-9+\-\s()]{6,20}$/.test(normalized)) {
      throw new BadRequestException('El celular no tiene un formato valido.');
    }

    return normalized;
  }

  private toOptionalUploadPath(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    if (
      !/^\/uploads\/usuarios\/[a-zA-Z0-9._-]+$/.test(normalized) ||
      normalized.length > 240
    ) {
      throw new BadRequestException('La imagen de usuario no es valida.');
    }

    return normalized;
  }
}
