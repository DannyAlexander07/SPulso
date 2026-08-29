import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  AnnouncementAudienceScope,
  AnnouncementPriority,
  AnnouncementStatus,
  EmailDeliveryStatus,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailDeliveryService } from '../../email/email-delivery.service';
import { hasGlobalCompanyAccess } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

type AnnouncementRecord = {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  status: AnnouncementStatus;
  priority: AnnouncementPriority;
  audienceScope: AnnouncementAudienceScope;
  publishAt: Date | null;
  expiresAt: Date | null;
  sendEmail: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  audiences: Array<{
    id: string;
    company: { id: string; name: string; slug: string } | null;
    team: {
      id: string;
      name: string;
      slug: string;
      company: { id: string; name: string; slug: string };
    } | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
      company: { id: string; name: string; slug: string };
    } | null;
  }>;
};

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(
    tenantId: string,
    filters?: {
      companyId?: string;
      priority?: string;
      scope?: string;
      search?: string;
      status?: string;
    },
  ) {
    const search = this.toOptionalString(filters?.search);
    const companyId = this.toOptionalString(filters?.companyId);
    const status = this.normalizeOptionalStatus(filters?.status);
    const priority = this.normalizeOptionalPriority(filters?.priority);
    const scope = this.normalizeOptionalScope(filters?.scope);
    const where: Prisma.AnnouncementWhereInput = { tenantId };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (scope) where.audienceScope = scope;
    if (companyId) {
      where.AND = [
        {
          OR: [
            { audienceScope: AnnouncementAudienceScope.ALL },
            { audiences: { some: { companyId } } },
            { audiences: { some: { team: { companyId } } } },
            { audiences: { some: { employee: { companyId } } } },
          ],
        },
      ];
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const announcements = await this.prisma.announcement.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { publishAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      select: this.announcementSelect(),
    });

    const data = await Promise.all(
      announcements.map((announcement) =>
        this.withMetrics(tenantId, announcement),
      ),
    );

    return {
      data,
      summary: {
        total: announcements.length,
        published: announcements.filter(
          (item) => item.status === AnnouncementStatus.PUBLISHED,
        ).length,
        scheduled: announcements.filter(
          (item) => item.status === AnnouncementStatus.SCHEDULED,
        ).length,
        pinned: announcements.filter((item) => item.isPinned).length,
        segmented: announcements.filter(
          (item) => item.audienceScope !== AnnouncementAudienceScope.ALL,
        ).length,
      },
    };
  }

  async findOne(actor: AuthUser, announcementId: string) {
    const tenantId = actor.tenantId;
    const announcement = await this.findAnnouncementOrThrow(
      tenantId,
      this.requireText(announcementId, 'El comunicado es obligatorio.'),
    );
    this.assertAnnouncementVisible(actor, announcement);
    const recipientWhere = this.recipientWhere(tenantId, announcement);
    const metrics = await this.metricsFor(tenantId, announcement);

    const [readers, pending, emailQueue] = await Promise.all([
      this.prisma.announcementRead.findMany({
        where: { tenantId, announcementId: announcement.id },
        orderBy: { readAt: 'desc' },
        take: 80,
        select: {
          id: true,
          readAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              personalEmail: true,
              company: { select: { id: true, name: true, slug: true } },
              team: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.employee.findMany({
        where: {
          ...recipientWhere,
          announcementReads: { none: { announcementId: announcement.id } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 80,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          personalEmail: true,
          company: { select: { id: true, name: true, slug: true } },
          team: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.announcementEmailDelivery.groupBy({
        by: ['status'],
        where: { tenantId, announcementId: announcement.id },
        _count: { id: true },
      }),
    ]);

    return {
      ...announcement,
      emailQueue: {
        failed:
          emailQueue.find((item) => item.status === EmailDeliveryStatus.FAILED)
            ?._count.id ?? 0,
        pending:
          (emailQueue.find(
            (item) => item.status === EmailDeliveryStatus.PENDING,
          )?._count.id ?? 0) +
          (emailQueue.find(
            (item) => item.status === EmailDeliveryStatus.PROCESSING,
          )?._count.id ?? 0),
        sent:
          emailQueue.find((item) => item.status === EmailDeliveryStatus.SENT)
            ?._count.id ?? 0,
        skipped:
          emailQueue.find((item) => item.status === EmailDeliveryStatus.SKIPPED)
            ?._count.id ?? 0,
        total: emailQueue.reduce((sum, item) => sum + item._count.id, 0),
      },
      metrics,
      readers,
      pending,
    };
  }

  async create(actor: AuthUser, dto: CreateAnnouncementDto) {
    const tenantId = actor.tenantId;
    const title = this.requireSafeText(
      dto.title,
      'El titulo es obligatorio.',
      100,
    );
    const message = this.requireSafeText(
      dto.message,
      'El mensaje es obligatorio.',
      1200,
    );
    const imageUrl = this.normalizeImageUrl(dto.imageUrl);
    await this.assertAnnouncementImageBinding(actor, imageUrl);
    const status = this.normalizeStatus(dto.status ?? AnnouncementStatus.DRAFT);
    const priority = this.normalizePriority(
      dto.priority ?? AnnouncementPriority.NORMAL,
    );
    const audienceScope = this.normalizeScope(
      dto.audienceScope ?? AnnouncementAudienceScope.ALL,
    );
    const companyIds = this.uniqueIds(dto.companyIds);
    const teamIds = this.uniqueIds(dto.teamIds);
    const employeeIds = this.uniqueIds(dto.employeeIds);

    await this.assertAudience(
      tenantId,
      audienceScope,
      companyIds,
      teamIds,
      employeeIds,
    );
    await this.assertScopedAudience(
      actor,
      audienceScope,
      companyIds,
      teamIds,
      employeeIds,
    );

    const announcement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          tenantId,
          title,
          message,
          imageUrl,
          status,
          priority,
          audienceScope,
          publishAt: this.toOptionalDate(dto.publishAt),
          expiresAt: this.toOptionalDate(dto.expiresAt),
          sendEmail: Boolean(dto.sendEmail),
          isPinned: Boolean(dto.isPinned),
        },
        select: { id: true },
      });

      await this.replaceAudiences(
        tx,
        tenantId,
        created.id,
        audienceScope,
        companyIds,
        teamIds,
        employeeIds,
      );

      return this.readAnnouncementSnapshot(tx, tenantId, created.id);
    });

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: actor.email,
      action: 'announcement.created',
      entityType: 'Announcement',
      entityId: announcement.id,
      summary: `Se creo el comunicado ${announcement.title}.`,
      after: this.toJson(this.snapshot(announcement)),
    });

    await this.syncCommunicationQueue(actor, announcement);

    return announcement;
  }

  async update(
    actor: AuthUser,
    announcementId: string,
    dto: UpdateAnnouncementDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireText(
      announcementId,
      'El comunicado es obligatorio.',
    );
    const current = await this.findAnnouncementOrThrow(tenantId, id);
    const audienceScope =
      dto.audienceScope !== undefined
        ? this.normalizeScope(dto.audienceScope)
        : current.audienceScope;
    const companyIds =
      dto.companyIds !== undefined
        ? this.uniqueIds(dto.companyIds)
        : current.audiences.flatMap((audience) =>
            audience.company ? [audience.company.id] : [],
          );
    const teamIds =
      dto.teamIds !== undefined
        ? this.uniqueIds(dto.teamIds)
        : current.audiences.flatMap((audience) =>
            audience.team ? [audience.team.id] : [],
          );
    const employeeIds =
      dto.employeeIds !== undefined
        ? this.uniqueIds(dto.employeeIds)
        : current.audiences.flatMap((audience) =>
            audience.employee ? [audience.employee.id] : [],
          );
    const shouldReplaceAudience =
      dto.audienceScope !== undefined ||
      dto.companyIds !== undefined ||
      dto.teamIds !== undefined ||
      dto.employeeIds !== undefined;
    const imageUrl =
      dto.imageUrl !== undefined
        ? this.normalizeImageUrl(dto.imageUrl)
        : undefined;
    if (imageUrl !== undefined) {
      await this.assertAnnouncementImageBinding(actor, imageUrl);
    }

    await this.assertScopedAudience(
      actor,
      current.audienceScope,
      current.audiences.flatMap((audience) =>
        audience.company ? [audience.company.id] : [],
      ),
      current.audiences.flatMap((audience) =>
        audience.team ? [audience.team.id] : [],
      ),
      current.audiences.flatMap((audience) =>
        audience.employee ? [audience.employee.id] : [],
      ),
    );

    if (shouldReplaceAudience) {
      await this.assertAudience(
        tenantId,
        audienceScope,
        companyIds,
        teamIds,
        employeeIds,
      );
      await this.assertScopedAudience(
        actor,
        audienceScope,
        companyIds,
        teamIds,
        employeeIds,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.announcement.update({
        where: { id: current.id },
        data: {
          ...(dto.title !== undefined
            ? {
                title: this.requireSafeText(
                  dto.title,
                  'El titulo es obligatorio.',
                  100,
                ),
              }
            : {}),
          ...(dto.message !== undefined
            ? {
                message: this.requireSafeText(
                  dto.message,
                  'El mensaje es obligatorio.',
                  1200,
                ),
              }
            : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl } : {}),
          ...(dto.status !== undefined
            ? { status: this.normalizeStatus(dto.status) }
            : {}),
          ...(dto.priority !== undefined
            ? { priority: this.normalizePriority(dto.priority) }
            : {}),
          ...(dto.audienceScope !== undefined ? { audienceScope } : {}),
          ...(dto.publishAt !== undefined
            ? { publishAt: this.toOptionalDate(dto.publishAt) }
            : {}),
          ...(dto.expiresAt !== undefined
            ? { expiresAt: this.toOptionalDate(dto.expiresAt) }
            : {}),
          ...(dto.sendEmail !== undefined
            ? { sendEmail: Boolean(dto.sendEmail) }
            : {}),
          ...(dto.isPinned !== undefined
            ? { isPinned: Boolean(dto.isPinned) }
            : {}),
        },
      });

      if (shouldReplaceAudience) {
        await this.replaceAudiences(
          tx,
          tenantId,
          current.id,
          audienceScope,
          companyIds,
          teamIds,
          employeeIds,
        );
      }

      return this.readAnnouncementSnapshot(tx, tenantId, current.id);
    });

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: actor.email,
      action: 'announcement.updated',
      entityType: 'Announcement',
      entityId: updated.id,
      summary: `Se actualizo el comunicado ${updated.title}.`,
      before: this.toJson(this.snapshot(current)),
      after: this.toJson(this.snapshot(updated)),
    });

    await this.syncCommunicationQueue(actor, updated);

    return updated;
  }

  async sendPendingEmails(actor: AuthUser, announcementId: string) {
    const tenantId = actor.tenantId;
    const announcement = await this.findAnnouncementOrThrow(
      tenantId,
      this.requireText(announcementId, 'El comunicado es obligatorio.'),
    );

    await this.assertScopedAudience(
      actor,
      announcement.audienceScope,
      announcement.audiences.flatMap((audience) =>
        audience.company ? [audience.company.id] : [],
      ),
      announcement.audiences.flatMap((audience) =>
        audience.team ? [audience.team.id] : [],
      ),
      announcement.audiences.flatMap((audience) =>
        audience.employee ? [audience.employee.id] : [],
      ),
    );

    if (announcement.status !== AnnouncementStatus.PUBLISHED) {
      throw new BadRequestException(
        'Solo se pueden enviar correos de comunicados publicados.',
      );
    }

    if (!announcement.sendEmail) {
      throw new BadRequestException(
        'Activa "Preparar envio por correo" antes de enviar.',
      );
    }

    await this.prisma.announcementEmailDelivery.updateMany({
      where: {
        tenantId,
        announcementId: announcement.id,
        status: EmailDeliveryStatus.PROCESSING,
        updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
      },
      data: { status: EmailDeliveryStatus.PENDING },
    });
    await this.prepareEmailDeliveries(tenantId, announcement);
    this.emailDelivery.assertReady();

    const pendingDeliveries =
      await this.prisma.announcementEmailDelivery.findMany({
        where: {
          tenantId,
          announcementId: announcement.id,
          status: EmailDeliveryStatus.PENDING,
        },
        take: 500,
        select: { email: true, id: true, subject: true },
      });
    let sent = 0;
    let failed = 0;
    const emailHtml = this.buildEmailTemplate(announcement);
    for (const delivery of pendingDeliveries) {
      const claimed = await this.prisma.announcementEmailDelivery.updateMany({
        where: { id: delivery.id, status: EmailDeliveryStatus.PENDING },
        data: {
          status: EmailDeliveryStatus.PROCESSING,
          errorMessage: null,
        },
      });
      if (claimed.count !== 1) continue;
      try {
        await this.emailDelivery.send({
          html: emailHtml,
          subject: delivery.subject,
          to: delivery.email,
        });
        await this.prisma.announcementEmailDelivery.updateMany({
          where: {
            id: delivery.id,
            status: EmailDeliveryStatus.PROCESSING,
          },
          data: {
            status: EmailDeliveryStatus.SENT,
            sentAt: new Date(),
            errorMessage: null,
          },
        });
        sent += 1;
      } catch (error) {
        await this.prisma.announcementEmailDelivery.updateMany({
          where: {
            id: delivery.id,
            status: EmailDeliveryStatus.PROCESSING,
          },
          data: {
            status: EmailDeliveryStatus.FAILED,
            sentAt: null,
            errorMessage:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Fallo desconocido del proveedor SMTP.',
          },
        });
        failed += 1;
      }
    }

    const mode = this.emailDelivery.mode();

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: actor.email,
      action:
        mode === 'simulation'
          ? 'announcement.email_simulated'
          : 'announcement.email_sent',
      entityType: 'Announcement',
      entityId: announcement.id,
      summary: `${sent} correos procesados y ${failed} fallidos para el comunicado ${announcement.title}.`,
      after: this.toJson({
        failed,
        mode,
        processed: sent + failed,
        sent,
        subject: `[Comunicado] ${announcement.title}`,
      }),
    });

    return {
      failed,
      mode,
      processed: sent + failed,
      previewHtml: emailHtml,
      sent,
      queue: await this.emailQueueSummary(tenantId, announcement.id),
    };
  }

  private announcementSelect() {
    return {
      ...this.announcementScalarSelect(),
      audiences: {
        select: {
          id: true,
          company: { select: { id: true, name: true, slug: true } },
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              company: { select: { id: true, name: true, slug: true } },
            },
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
              company: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
    };
  }

  private announcementScalarSelect() {
    return {
      id: true,
      title: true,
      message: true,
      imageUrl: true,
      status: true,
      priority: true,
      audienceScope: true,
      publishAt: true,
      expiresAt: true,
      sendEmail: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private async readAnnouncementSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    announcementId: string,
  ): Promise<AnnouncementRecord> {
    const announcement = await tx.announcement.findFirst({
      where: { id: announcementId, tenantId },
      select: this.announcementScalarSelect(),
    });
    if (!announcement) {
      throw new ConflictException(
        'El comunicado cambio mientras se guardaba. Intenta nuevamente.',
      );
    }

    const links = await tx.announcementAudience.findMany({
      where: { announcementId, tenantId },
      select: { id: true, companyId: true, teamId: true, employeeId: true },
    });
    const teamIds = links.flatMap((link) => (link.teamId ? [link.teamId] : []));
    const employeeIds = links.flatMap((link) =>
      link.employeeId ? [link.employeeId] : [],
    );
    const teams = await tx.workTeam.findMany({
      where: { id: { in: teamIds }, tenantId },
      select: { id: true, name: true, slug: true, companyId: true },
    });
    const employees = await tx.employee.findMany({
      where: { id: { in: employeeIds }, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        companyId: true,
      },
    });
    const companyIds = [
      ...links.flatMap((link) => (link.companyId ? [link.companyId] : [])),
      ...teams.map((team) => team.companyId),
      ...employees.map((employee) => employee.companyId),
    ];
    const companies = await tx.company.findMany({
      where: { id: { in: [...new Set(companyIds)] }, tenantId },
      select: { id: true, name: true, slug: true },
    });
    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const employeeById = new Map(
      employees.map((employee) => [employee.id, employee]),
    );

    const audiences: AnnouncementRecord['audiences'] = links.map((link) => {
      const team = link.teamId ? teamById.get(link.teamId) : undefined;
      const employee = link.employeeId
        ? employeeById.get(link.employeeId)
        : undefined;
      const company = link.companyId
        ? companyById.get(link.companyId)
        : undefined;
      if (
        (link.companyId && !company) ||
        (link.teamId && (!team || !companyById.has(team.companyId))) ||
        (link.employeeId && (!employee || !companyById.has(employee.companyId)))
      ) {
        throw new ConflictException(
          'La audiencia cambio mientras se guardaba el comunicado.',
        );
      }

      return {
        id: link.id,
        company: company ?? null,
        team: team
          ? { ...team, company: companyById.get(team.companyId)! }
          : null,
        employee: employee
          ? { ...employee, company: companyById.get(employee.companyId)! }
          : null,
      };
    });

    return { ...announcement, audiences };
  }

  private async findAnnouncementOrThrow(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: this.announcementSelect(),
    });

    if (
      !announcement ||
      !(await this.belongsToTenant(tenantId, announcement.id))
    ) {
      throw new BadRequestException('El comunicado seleccionado no existe.');
    }

    return announcement;
  }

  private async withMetrics(
    tenantId: string,
    announcement: AnnouncementRecord,
  ) {
    return {
      ...announcement,
      metrics: await this.metricsFor(tenantId, announcement),
    };
  }

  private async syncCommunicationQueue(
    actor: AuthUser,
    announcement: AnnouncementRecord,
  ) {
    await this.syncAnnouncementNotifications(actor, announcement);

    if (
      announcement.status === AnnouncementStatus.PUBLISHED &&
      announcement.sendEmail
    ) {
      await this.prepareEmailDeliveries(actor.tenantId, announcement);
      return;
    }

    await this.prisma.announcementEmailDelivery.deleteMany({
      where: { announcementId: announcement.id, tenantId: actor.tenantId },
    });
  }

  private async syncAnnouncementNotifications(
    actor: AuthUser,
    announcement: AnnouncementRecord,
  ) {
    const scopedCompanyIds: string[] = [
      ...new Set(
        announcement.audiences.flatMap((audience) =>
          audience.company ? [audience.company.id] : [],
        ),
      ),
    ];
    const companyIds: Array<string | null> =
      announcement.audienceScope === AnnouncementAudienceScope.ALL
        ? [null]
        : announcement.audienceScope === AnnouncementAudienceScope.COMPANIES
          ? scopedCompanyIds
          : [];
    const prefix = `announcement-published:${announcement.id}:`;
    const targets: Array<{ companyId: string | null; ruleKey: string }> =
      companyIds.map((companyId) => ({
        companyId,
        ruleKey: `${prefix}${companyId ?? 'all'}`,
      }));
    const ruleKeys = targets.map((target) => target.ruleKey);

    if (announcement.status !== AnnouncementStatus.PUBLISHED) {
      await this.prisma.notification.deleteMany({
        where: {
          tenantId: actor.tenantId,
          OR: [
            { ruleKey: `announcement-published:${announcement.id}` },
            { ruleKey: { startsWith: prefix } },
          ],
        },
      });
      return;
    }

    await this.prisma.notification.deleteMany({
      where: {
        tenantId: actor.tenantId,
        OR: [
          { ruleKey: `announcement-published:${announcement.id}` },
          {
            ruleKey: {
              startsWith: prefix,
              ...(ruleKeys.length > 0 ? { notIn: ruleKeys } : {}),
            },
          },
        ],
      },
    });

    await Promise.all(
      targets.map(({ companyId, ruleKey }) =>
        this.prisma.notification.upsert({
          where: {
            tenantId_ruleKey: {
              tenantId: actor.tenantId,
              ruleKey,
            },
          },
          create: {
            tenantId: actor.tenantId,
            companyId,
            type: NotificationType.ANNOUNCEMENT_PUBLISHED,
            priority:
              announcement.priority === AnnouncementPriority.URGENT
                ? NotificationPriority.CRITICAL
                : announcement.priority === AnnouncementPriority.IMPORTANT
                  ? NotificationPriority.WARNING
                  : NotificationPriority.INFO,
            title: 'Comunicado publicado',
            message: `Se publico el comunicado: ${announcement.title}.`,
            actionHref: `/comunicados/${announcement.id}`,
            entityType: 'Announcement',
            entityId: announcement.id,
            ruleKey,
          },
          update: {
            companyId,
            message: `Se publico el comunicado: ${announcement.title}.`,
            actionHref: `/comunicados/${announcement.id}`,
            generatedAt: new Date(),
            status: NotificationStatus.UNREAD,
            readAt: null,
          },
        }),
      ),
    );
  }

  private async prepareEmailDeliveries(
    tenantId: string,
    announcement: AnnouncementRecord,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.announcement.findUnique({
          where: { id: announcement.id },
          select: { tenantId: true, updatedAt: true },
        });
        if (
          !current ||
          current.tenantId !== tenantId ||
          current.updatedAt.getTime() !== announcement.updatedAt.getTime()
        ) {
          throw new ConflictException(
            'La audiencia del comunicado cambio mientras se preparaba el envio.',
          );
        }

        const recipients = await tx.employee.findMany({
          where: this.recipientWhere(tenantId, announcement),
          take: 5000,
          select: { id: true, personalEmail: true },
        });
        const recipientIds = recipients.map((employee) => employee.id);
        await tx.announcementEmailDelivery.deleteMany({
          where: {
            announcementId: announcement.id,
            tenantId,
            ...(recipientIds.length > 0
              ? { employeeId: { notIn: recipientIds } }
              : {}),
            status: {
              notIn: [EmailDeliveryStatus.SENT, EmailDeliveryStatus.PROCESSING],
            },
          },
        });

        const existing = await tx.announcementEmailDelivery.findMany({
          where: { announcementId: announcement.id, tenantId },
          select: { employeeId: true, status: true },
        });
        const statusByEmployee = new Map(
          existing.map((delivery) => [delivery.employeeId, delivery.status]),
        );

        // Keep sent deliveries immutable as historical evidence. Rebuild every
        // unsent delivery in two bulk statements so one transaction never runs
        // concurrent client.query calls and large audiences remain bounded.
        await tx.announcementEmailDelivery.deleteMany({
          where: {
            announcementId: announcement.id,
            tenantId,
            status: {
              notIn: [EmailDeliveryStatus.SENT, EmailDeliveryStatus.PROCESSING],
            },
          },
        });

        const pendingRecipients = recipients.filter(
          (employee) =>
            statusByEmployee.get(employee.id) !== EmailDeliveryStatus.SENT &&
            statusByEmployee.get(employee.id) !==
              EmailDeliveryStatus.PROCESSING,
        );
        if (pendingRecipients.length > 0) {
          await tx.announcementEmailDelivery.createMany({
            data: pendingRecipients.map((employee) => {
              const email = this.toOptionalString(employee.personalEmail);
              return {
                tenantId,
                announcementId: announcement.id,
                employeeId: employee.id,
                email: email ?? 'sin-correo@spulso.local',
                status: email
                  ? EmailDeliveryStatus.PENDING
                  : EmailDeliveryStatus.SKIPPED,
                subject: `[Comunicado] ${announcement.title}`,
                errorMessage: email
                  ? null
                  : 'El trabajador no tiene correo personal registrado.',
              };
            }),
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
  }

  private async emailQueueSummary(tenantId: string, announcementId: string) {
    const emailQueue = await this.prisma.announcementEmailDelivery.groupBy({
      by: ['status'],
      where: { tenantId, announcementId },
      _count: { id: true },
    });

    return {
      failed:
        emailQueue.find((item) => item.status === EmailDeliveryStatus.FAILED)
          ?._count.id ?? 0,
      pending:
        (emailQueue.find((item) => item.status === EmailDeliveryStatus.PENDING)
          ?._count.id ?? 0) +
        (emailQueue.find(
          (item) => item.status === EmailDeliveryStatus.PROCESSING,
        )?._count.id ?? 0),
      sent:
        emailQueue.find((item) => item.status === EmailDeliveryStatus.SENT)
          ?._count.id ?? 0,
      skipped:
        emailQueue.find((item) => item.status === EmailDeliveryStatus.SKIPPED)
          ?._count.id ?? 0,
      total: emailQueue.reduce((sum, item) => sum + item._count.id, 0),
    };
  }

  private buildEmailTemplate(announcement: AnnouncementRecord) {
    const title = this.escapeHtml(announcement.title);
    const message = this.escapeHtml(announcement.message).replace(
      /\n/g,
      '<br />',
    );
    const imageUrl = announcement.imageUrl
      ? this.publicMediaUrl(announcement.imageUrl)
      : null;
    const portalUrl = `${this.publicWebUrl()}/portal/comunicados`;

    return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f242d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e1e5eb;">
            <tr>
              <td style="padding:26px 28px 10px;">
                <div style="font-size:13px;font-weight:700;color:#1f5eff;letter-spacing:.08em;text-transform:uppercase;">SPulso</div>
                <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;color:#1f242d;">${title}</h1>
              </td>
            </tr>
            ${
              imageUrl
                ? `<tr><td style="padding:18px 28px 0;"><img src="${imageUrl}" alt="" style="display:block;width:100%;border-radius:14px;border:1px solid #e1e5eb;" /></td></tr>`
                : ''
            }
            <tr>
              <td style="padding:22px 28px 8px;font-size:15px;line-height:1.7;color:#475467;">${message}</td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px;">
                <a href="${portalUrl}" style="display:inline-block;background:#1f5eff;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 18px;font-size:14px;font-weight:700;">Ver comunicado</a>
              </td>
            </tr>
            <tr>
              <td style="background:#fbfcfd;border-top:1px solid #e1e5eb;padding:16px 28px;font-size:12px;color:#667085;">
                Este mensaje fue preparado desde SPulso para comunicaciones internas.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private async metricsFor(tenantId: string, announcement: AnnouncementRecord) {
    const [estimatedRecipients, readCount] = await Promise.all([
      this.prisma.employee.count({
        where: this.recipientWhere(tenantId, announcement),
      }),
      this.prisma.announcementRead.count({
        where: { tenantId, announcementId: announcement.id },
      }),
    ]);
    const pendingCount = Math.max(0, estimatedRecipients - readCount);
    const readRate =
      estimatedRecipients > 0
        ? Math.round((readCount / estimatedRecipients) * 100)
        : 0;

    return { estimatedRecipients, pendingCount, readCount, readRate };
  }

  private recipientWhere(
    tenantId: string,
    announcement: AnnouncementRecord,
  ): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = { tenantId, status: 'ACTIVE' };

    if (announcement.audienceScope === AnnouncementAudienceScope.COMPANIES) {
      const companyIds = announcement.audiences.flatMap((audience) =>
        audience.company ? [audience.company.id] : [],
      );
      return {
        ...where,
        companyId: { in: companyIds.length > 0 ? companyIds : ['__none__'] },
      };
    }

    if (announcement.audienceScope === AnnouncementAudienceScope.TEAMS) {
      const teamIds = announcement.audiences.flatMap((audience) =>
        audience.team ? [audience.team.id] : [],
      );
      return {
        ...where,
        teamId: { in: teamIds.length > 0 ? teamIds : ['__none__'] },
      };
    }

    if (announcement.audienceScope === AnnouncementAudienceScope.EMPLOYEES) {
      const employeeIds = announcement.audiences.flatMap((audience) =>
        audience.employee ? [audience.employee.id] : [],
      );
      return {
        ...where,
        id: { in: employeeIds.length > 0 ? employeeIds : ['__none__'] },
      };
    }

    return where;
  }

  private async belongsToTenant(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    return announcement?.tenantId === tenantId;
  }

  private async replaceAudiences(
    tx: Prisma.TransactionClient,
    tenantId: string,
    announcementId: string,
    audienceScope: AnnouncementAudienceScope,
    companyIds: string[],
    teamIds: string[],
    employeeIds: string[],
  ) {
    await tx.announcementAudience.deleteMany({ where: { announcementId } });

    if (
      audienceScope === AnnouncementAudienceScope.COMPANIES &&
      companyIds.length > 0
    ) {
      await tx.announcementAudience.createMany({
        data: companyIds.map((companyId) => ({
          tenantId,
          announcementId,
          companyId,
        })),
      });
    }

    if (
      audienceScope === AnnouncementAudienceScope.TEAMS &&
      teamIds.length > 0
    ) {
      await tx.announcementAudience.createMany({
        data: teamIds.map((teamId) => ({ tenantId, announcementId, teamId })),
      });
    }

    if (
      audienceScope === AnnouncementAudienceScope.EMPLOYEES &&
      employeeIds.length > 0
    ) {
      await tx.announcementAudience.createMany({
        data: employeeIds.map((employeeId) => ({
          tenantId,
          announcementId,
          employeeId,
        })),
      });
    }
  }

  private async assertAudience(
    tenantId: string,
    audienceScope: AnnouncementAudienceScope,
    companyIds: string[],
    teamIds: string[],
    employeeIds: string[],
  ) {
    if (audienceScope === AnnouncementAudienceScope.COMPANIES) {
      if (companyIds.length === 0)
        throw new BadRequestException('Selecciona al menos una empresa.');
      const companies = await this.prisma.company.findMany({
        where: { tenantId, id: { in: companyIds } },
      });
      if (companies.length !== companyIds.length) {
        throw new BadRequestException(
          'Una o mas empresas seleccionadas no existen.',
        );
      }
    }

    if (audienceScope === AnnouncementAudienceScope.TEAMS) {
      if (teamIds.length === 0)
        throw new BadRequestException('Selecciona al menos un equipo.');
      const teams = await this.prisma.workTeam.findMany({
        where: { tenantId, id: { in: teamIds } },
      });
      if (teams.length !== teamIds.length) {
        throw new BadRequestException(
          'Uno o mas equipos seleccionados no existen.',
        );
      }
    }

    if (audienceScope === AnnouncementAudienceScope.EMPLOYEES) {
      if (employeeIds.length === 0)
        throw new BadRequestException('Selecciona al menos un trabajador.');
      const employees = await this.prisma.employee.findMany({
        where: { tenantId, id: { in: employeeIds }, status: 'ACTIVE' },
      });
      if (employees.length !== employeeIds.length) {
        throw new BadRequestException(
          'Uno o mas trabajadores seleccionados no existen o no estan activos.',
        );
      }
    }
  }

  private assertAnnouncementVisible(
    actor: AuthUser,
    announcement: AnnouncementRecord,
  ) {
    if (hasGlobalCompanyAccess(actor)) {
      return;
    }

    if (!actor.companyId) {
      throw new BadRequestException('Tu usuario no tiene empresa asignada.');
    }

    if (announcement.audienceScope === AnnouncementAudienceScope.ALL) {
      return;
    }

    const companyIds = announcement.audiences.flatMap((audience) =>
      audience.company ? [audience.company.id] : [],
    );
    const teamCompanyIds = announcement.audiences.flatMap((audience) =>
      audience.team ? [audience.team.company.id] : [],
    );
    const employeeCompanyIds = announcement.audiences.flatMap((audience) =>
      audience.employee ? [audience.employee.company.id] : [],
    );

    if (
      !companyIds.includes(actor.companyId) &&
      !teamCompanyIds.includes(actor.companyId) &&
      !employeeCompanyIds.includes(actor.companyId)
    ) {
      throw new BadRequestException('No tienes acceso a este comunicado.');
    }
  }

  private async assertScopedAudience(
    actor: AuthUser,
    audienceScope: AnnouncementAudienceScope,
    companyIds: string[],
    teamIds: string[],
    employeeIds: string[],
  ) {
    if (hasGlobalCompanyAccess(actor)) {
      return;
    }

    if (!actor.companyId) {
      throw new BadRequestException('Tu usuario no tiene empresa asignada.');
    }

    if (audienceScope === AnnouncementAudienceScope.ALL) {
      throw new BadRequestException(
        'Solo un administrador global puede publicar comunicados para todas las empresas.',
      );
    }

    if (
      audienceScope === AnnouncementAudienceScope.COMPANIES &&
      companyIds.some((companyId) => companyId !== actor.companyId)
    ) {
      throw new BadRequestException(
        'No puedes publicar comunicados para otra empresa.',
      );
    }

    if (
      audienceScope === AnnouncementAudienceScope.TEAMS &&
      teamIds.length > 0
    ) {
      const teams = await this.prisma.workTeam.count({
        where: {
          id: { in: teamIds },
          tenantId: actor.tenantId,
          companyId: actor.companyId,
        },
      });

      if (teams !== teamIds.length) {
        throw new BadRequestException(
          'No puedes publicar comunicados para equipos de otra empresa.',
        );
      }
    }

    if (
      audienceScope === AnnouncementAudienceScope.EMPLOYEES &&
      employeeIds.length > 0
    ) {
      const employees = await this.prisma.employee.count({
        where: {
          id: { in: employeeIds },
          tenantId: actor.tenantId,
          companyId: actor.companyId,
          status: 'ACTIVE',
        },
      });

      if (employees !== employeeIds.length) {
        throw new BadRequestException(
          'No puedes publicar comunicados para trabajadores de otra empresa.',
        );
      }
    }
  }

  private snapshot(announcement: {
    id: string;
    title: string;
    imageUrl?: string | null;
    status: AnnouncementStatus;
    priority: AnnouncementPriority;
    audienceScope: AnnouncementAudienceScope;
  }) {
    return {
      id: announcement.id,
      title: announcement.title,
      imageUrl: announcement.imageUrl ?? null,
      status: announcement.status,
      priority: announcement.priority,
      audienceScope: announcement.audienceScope,
    };
  }

  private normalizeStatus(value: unknown) {
    const normalized = this.requireText(value, 'El estado es obligatorio.');
    if (!(normalized in AnnouncementStatus))
      throw new BadRequestException('El estado no es valido.');
    return AnnouncementStatus[normalized as keyof typeof AnnouncementStatus];
  }

  private normalizeOptionalStatus(value: unknown) {
    const normalized = this.toOptionalString(value);
    return normalized ? this.normalizeStatus(normalized) : undefined;
  }

  private normalizePriority(value: unknown) {
    const normalized = this.requireText(value, 'La prioridad es obligatoria.');
    if (!(normalized in AnnouncementPriority))
      throw new BadRequestException('La prioridad no es valida.');
    return AnnouncementPriority[
      normalized as keyof typeof AnnouncementPriority
    ];
  }

  private normalizeOptionalPriority(value: unknown) {
    const normalized = this.toOptionalString(value);
    return normalized ? this.normalizePriority(normalized) : undefined;
  }

  private normalizeScope(value: unknown) {
    const normalized = this.requireText(
      value ?? AnnouncementAudienceScope.ALL,
      'El alcance es obligatorio.',
    );
    if (!(normalized in AnnouncementAudienceScope))
      throw new BadRequestException('El alcance no es valido.');
    return AnnouncementAudienceScope[
      normalized as keyof typeof AnnouncementAudienceScope
    ];
  }

  private normalizeOptionalScope(value: unknown) {
    const normalized = this.toOptionalString(value);
    return normalized ? this.normalizeScope(normalized) : undefined;
  }

  private toOptionalDate(value: unknown) {
    const normalized = this.toOptionalString(value);
    if (!normalized) return null;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('La fecha no es valida.');
    return date;
  }

  private requireText(value: unknown, message: string) {
    const normalized = this.toOptionalString(value);
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private requireSafeText(value: unknown, message: string, maxLength: number) {
    const normalized = this.requireText(value, message);
    if (normalized.length > maxLength)
      throw new BadRequestException(`Maximo ${maxLength} caracteres.`);
    if (/[<>]/.test(normalized)) throw new BadRequestException(message);
    return normalized;
  }

  private normalizeImageUrl(value: unknown) {
    const normalized = this.toOptionalString(value);
    if (!normalized) return null;
    if (normalized.length > 500)
      throw new BadRequestException('La URL de imagen es demasiado larga.');
    if (/[<>"'`]/.test(normalized))
      throw new BadRequestException('La URL de imagen no es valida.');

    if (normalized.startsWith('/uploads/')) return normalized;

    try {
      const url = new URL(normalized);
      if (url.protocol !== 'https:') throw new Error('invalid protocol');
      return url.toString();
    } catch {
      throw new BadRequestException(
        'Usa una imagen con URL https o una ruta interna /uploads/.',
      );
    }
  }

  private async assertAnnouncementImageBinding(
    actor: AuthUser,
    imageUrl: string | null,
  ) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
    const expectedPrefix = `/uploads/comunicados/${actor.tenantId}--${actor.sub}--`;
    if (imageUrl.startsWith(expectedPrefix)) return;

    const owner = await this.prisma.announcement.findFirst({
      where: { imageUrl, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!owner) {
      throw new BadRequestException(
        'La imagen no pertenece a este espacio de trabajo.',
      );
    }
    const announcement = await this.findAnnouncementOrThrow(
      actor.tenantId,
      owner.id,
    );
    this.assertAnnouncementVisible(actor, announcement);
  }

  private publicMediaUrl(value: string) {
    if (value.startsWith('/uploads/')) return `${this.publicApiUrl()}${value}`;
    return value;
  }

  private publicApiUrl() {
    return (
      process.env.PUBLIC_API_URL ??
      `http://localhost:${process.env.PORT ?? 3001}`
    );
  }

  private publicWebUrl() {
    return (
      process.env.PUBLIC_WEB_URL ??
      process.env.WEB_URL ??
      'http://localhost:3000'
    );
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private toOptionalString(value: unknown) {
    if (value === null || value === undefined) return null;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    )
      return null;

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private uniqueIds(values: unknown) {
    if (!Array.isArray(values)) return [];
    const ids = Array.from(
      new Set(
        values
          .map((value) => this.toOptionalString(value))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (ids.length > 100)
      throw new BadRequestException('Selecciona como maximo 100 audiencias.');
    return ids;
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }
}
