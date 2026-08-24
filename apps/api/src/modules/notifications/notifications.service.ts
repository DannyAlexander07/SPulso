import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  AutomationRuleType,
  DocumentStatus,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
  Prisma,
  RequestStatus,
} from '@prisma/client';
import {
  buildPaginationMeta,
  sliceCursorPage,
  toOptionalCursor,
} from '../../common/pagination';
import { PrismaService } from '../../database/prisma.service';
import { AutomationsService } from '../automations/automations.service';
import { hasGlobalCompanyAccess } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';

type NotificationSeed = {
  actionHref: string;
  companyId: string | null;
  entityId: string;
  entityType: string;
  message: string;
  priority: NotificationPriority;
  ruleKey: string;
  title: string;
  type: NotificationType;
};

type EnabledRule = {
  id: string;
  type: AutomationRuleType;
  thresholdDays: number | null;
  thresholdHours: number | null;
  thresholdCount: number | null;
  windowDays: number | null;
  priority: NotificationPriority;
};

const NOTIFICATION_SYNC_TTL_MS = 60_000;
const notificationSyncs = new Map<
  string,
  { completedAt: number; running: Promise<void> | null }
>();
const notificationSeedOffsets = new Map<string, number>();

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automationsService: AutomationsService,
  ) {}

  async findAll(
    user: AuthUser,
    filters?: {
      cursor?: string;
      cursorMode?: boolean;
      page?: string;
      pageSize?: string;
      priority?: string;
      status?: string;
      type?: string;
    },
  ) {
    await this.syncAutomatedNotifications(user.tenantId);

    const page = this.normalizePage(filters?.page);
    const pageSize = this.normalizePageSize(filters?.pageSize);
    const cursor = toOptionalCursor(filters?.cursor);
    const cursorMode = filters?.cursorMode === true;
    const priority = this.normalizeOptionalPriority(filters?.priority);
    const status = this.normalizeOptionalStatus(filters?.status);
    const type = this.normalizeOptionalType(filters?.type);
    const where: Prisma.NotificationWhereInput = {
      tenantId: user.tenantId,
      ...this.notificationScope(user),
    };

    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (type) where.type = type;

    const orderBy = [
      { status: 'asc' as const },
      { priority: 'desc' as const },
      { generatedAt: 'desc' as const },
      { id: 'desc' as const },
    ];

    if (cursor || cursorMode) {
      const items = await this.prisma.notification.findMany({
        where,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy,
        take: pageSize + 1,
        select: this.notificationSelect(),
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
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.notificationSelect(),
      }),
    ]);

    return {
      data,
      meta: {
        ...buildPaginationMeta({ page, pageSize, total }),
      },
    };
  }

  async getSummary(user: AuthUser) {
    await this.syncAutomatedNotifications(user.tenantId);

    const grouped = await this.prisma.notification.groupBy({
      by: ['status', 'priority'],
      where: { tenantId: user.tenantId, ...this.notificationScope(user) },
      _count: { id: true },
    });

    const counts = { critical: 0, read: 0, total: 0, unread: 0, warning: 0 };

    for (const item of grouped) {
      counts.total += item._count.id;

      if (item.status === NotificationStatus.UNREAD) {
        counts.unread += item._count.id;
      } else {
        counts.read += item._count.id;
      }

      if (
        item.status === NotificationStatus.UNREAD &&
        item.priority === NotificationPriority.CRITICAL
      ) {
        counts.critical += item._count.id;
      }

      if (
        item.status === NotificationStatus.UNREAD &&
        item.priority === NotificationPriority.WARNING
      ) {
        counts.warning += item._count.id;
      }
    }

    return counts;
  }

  async markAsRead(user: AuthUser, id: string) {
    const notificationId = this.toOptionalString(id);

    if (!notificationId) {
      throw new BadRequestException('La notificacion es obligatoria.');
    }

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, tenantId: true, companyId: true },
    });

    if (
      !notification ||
      notification.tenantId !== user.tenantId ||
      !this.canAccessNotification(user, notification.companyId)
    ) {
      throw new BadRequestException('La notificacion seleccionada no existe.');
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date(), status: NotificationStatus.READ },
      select: this.notificationSelect(),
    });
  }

  async markAsUnread(user: AuthUser, id: string) {
    const notificationId = this.toOptionalString(id);

    if (!notificationId) {
      throw new BadRequestException('La notificacion es obligatoria.');
    }

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, tenantId: true, companyId: true },
    });

    if (
      !notification ||
      notification.tenantId !== user.tenantId ||
      !this.canAccessNotification(user, notification.companyId)
    ) {
      throw new BadRequestException('La notificacion seleccionada no existe.');
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: null, status: NotificationStatus.UNREAD },
      select: this.notificationSelect(),
    });
  }

  private notificationScope(user: AuthUser): Prisma.NotificationWhereInput {
    if (hasGlobalCompanyAccess(user)) {
      return {};
    }

    if (!user.companyId) {
      return { companyId: '__none__' };
    }

    return {
      OR: [{ companyId: user.companyId }, { companyId: null }],
    };
  }

  private canAccessNotification(user: AuthUser, companyId: string | null) {
    return (
      hasGlobalCompanyAccess(user) ||
      companyId === null ||
      (!!user.companyId && companyId === user.companyId)
    );
  }

  private async syncAutomatedNotifications(tenantId: string) {
    const current = notificationSyncs.get(tenantId);
    if (current?.running) return current.running;
    if (
      current &&
      Date.now() - current.completedAt < NOTIFICATION_SYNC_TTL_MS
    ) {
      return;
    }

    const running = this.performAutomatedNotificationSync(tenantId).finally(
      () => {
        notificationSyncs.set(tenantId, {
          completedAt: Date.now(),
          running: null,
        });
      },
    );
    notificationSyncs.set(tenantId, {
      completedAt: current?.completedAt ?? 0,
      running,
    });
    return running;
  }

  private async performAutomatedNotificationSync(tenantId: string) {
    await this.deleteOrphanedDocumentNotifications(tenantId);

    const rules = await this.automationsService.getEnabledRules(tenantId);
    const seeds = await this.buildNotificationSeeds(
      tenantId,
      this.startOfToday(),
      rules,
    );

    const start = seeds.length
      ? (notificationSeedOffsets.get(tenantId) ?? 0) % seeds.length
      : 0;
    const cappedSeeds = seeds.length
      ? [...seeds.slice(start), ...seeds.slice(0, start)].slice(0, 500)
      : [];
    if (seeds.length > 0) {
      notificationSeedOffsets.set(
        tenantId,
        (start + cappedSeeds.length) % seeds.length,
      );
    } else {
      notificationSeedOffsets.delete(tenantId);
    }
    for (let index = 0; index < cappedSeeds.length; index += 25) {
      const batch = cappedSeeds.slice(index, index + 25);
      await Promise.all(
        batch.map((seed) =>
          this.prisma.notification.upsert({
            where: { tenantId_ruleKey: { tenantId, ruleKey: seed.ruleKey } },
            create: { tenantId, ...seed },
            update: {
              actionHref: seed.actionHref,
              companyId: seed.companyId,
              message: seed.message,
              priority: seed.priority,
              title: seed.title,
              generatedAt: new Date(),
            },
          }),
        ),
      );
    }
  }

  private async deleteOrphanedDocumentNotifications(tenantId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { tenantId, entityType: 'EmployeeDocument' },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { id: true, entityId: true },
    });

    if (notifications.length === 0) {
      return;
    }

    const documentIds = [
      ...new Set(
        notifications
          .map((notification) => this.toOptionalString(notification.entityId))
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (documentIds.length === 0) {
      await this.prisma.notification.deleteMany({
        where: {
          tenantId,
          id: { in: notifications.map((notification) => notification.id) },
        },
      });
      return;
    }

    const existingDocuments = await this.prisma.employeeDocument.findMany({
      where: { tenantId, id: { in: documentIds } },
      select: { id: true },
    });
    const existingIds = new Set(
      existingDocuments.map((document) => document.id),
    );
    const staleNotificationIds = notifications
      .filter(
        (notification) =>
          !notification.entityId || !existingIds.has(notification.entityId),
      )
      .map((notification) => notification.id);

    if (staleNotificationIds.length === 0) {
      return;
    }

    await this.prisma.notification.deleteMany({
      where: { tenantId, id: { in: staleNotificationIds } },
    });
  }

  private async buildNotificationSeeds(
    tenantId: string,
    today: Date,
    rules: EnabledRule[],
  ): Promise<NotificationSeed[]> {
    const seeds: NotificationSeed[] = [];
    const ruleByType = new Map(rules.map((rule) => [rule.type, rule]));

    await this.addExpiredDocumentSeeds(
      tenantId,
      ruleByType.get(AutomationRuleType.DOCUMENT_EXPIRED),
      seeds,
    );
    await this.addExpiringDocumentSeeds(
      tenantId,
      today,
      ruleByType.get(AutomationRuleType.DOCUMENT_EXPIRING),
      seeds,
    );
    await this.addPendingSignatureSeeds(
      tenantId,
      ruleByType.get(AutomationRuleType.DOCUMENT_PENDING_SIGNATURE),
      seeds,
    );
    await this.addPendingRequestSeeds(
      tenantId,
      ruleByType.get(AutomationRuleType.REQUEST_PENDING),
      seeds,
    );
    await this.addRepeatedLateSeeds(
      tenantId,
      today,
      ruleByType.get(AutomationRuleType.ATTENDANCE_LATE_REPEATED),
      seeds,
    );

    return seeds;
  }

  private async addExpiredDocumentSeeds(
    tenantId: string,
    rule: EnabledRule | undefined,
    seeds: NotificationSeed[],
  ) {
    if (!rule) return;

    const documents = await this.prisma.employeeDocument.findMany({
      where: { tenantId, status: DocumentStatus.EXPIRED },
      take: 20,
      orderBy: { expiresAt: 'asc' },
      select: this.documentSeedSelect(),
    });

    seeds.push(
      ...documents.map(
        (document): NotificationSeed => ({
          actionHref: '/documentos?estado=EXPIRED',
          companyId: document.companyId,
          entityId: document.id,
          entityType: 'EmployeeDocument',
          message: `${this.personName(document.employee)} tiene un documento vencido: ${document.title}.`,
          priority: rule.priority,
          ruleKey: `document-expired:${document.id}`,
          title: 'Documento vencido',
          type: NotificationType.DOCUMENT_EXPIRED,
        }),
      ),
    );
  }

  private async addExpiringDocumentSeeds(
    tenantId: string,
    today: Date,
    rule: EnabledRule | undefined,
    seeds: NotificationSeed[],
  ) {
    if (!rule) return;

    const thresholdDays = rule.thresholdDays ?? 30;
    const documents = await this.prisma.employeeDocument.findMany({
      where: {
        tenantId,
        status: { not: DocumentStatus.EXPIRED },
        expiresAt: { gte: today, lte: this.addDays(today, thresholdDays) },
      },
      take: 20,
      orderBy: { expiresAt: 'asc' },
      select: this.documentSeedSelect(),
    });

    seeds.push(
      ...documents.map(
        (document): NotificationSeed => ({
          actionHref: '/documentos',
          companyId: document.companyId,
          entityId: document.id,
          entityType: 'EmployeeDocument',
          message: `${document.title} vence el ${this.formatDate(document.expiresAt)} para ${this.personName(document.employee)}.`,
          priority: rule.priority,
          ruleKey: `document-expiring:${document.id}`,
          title: 'Documento por vencer',
          type: NotificationType.DOCUMENT_EXPIRING,
        }),
      ),
    );
  }

  private async addPendingSignatureSeeds(
    tenantId: string,
    rule: EnabledRule | undefined,
    seeds: NotificationSeed[],
  ) {
    if (!rule) return;

    const documents = await this.prisma.employeeDocument.findMany({
      where: { tenantId, status: DocumentStatus.PENDING_SIGNATURE },
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: this.documentSeedSelect(),
    });

    seeds.push(
      ...documents.map(
        (document): NotificationSeed => ({
          actionHref: '/documentos?estado=PENDING_SIGNATURE',
          companyId: document.companyId,
          entityId: document.id,
          entityType: 'EmployeeDocument',
          message: `${this.personName(document.employee)} tiene pendiente firmar ${document.title}.`,
          priority: rule.priority,
          ruleKey: `document-signature:${document.id}`,
          title: 'Firma pendiente',
          type: NotificationType.DOCUMENT_PENDING_SIGNATURE,
        }),
      ),
    );
  }

  private async addPendingRequestSeeds(
    tenantId: string,
    rule: EnabledRule | undefined,
    seeds: NotificationSeed[],
  ) {
    if (!rule) return;

    const thresholdHours = rule.thresholdHours ?? 48;
    const requests = await this.prisma.employeeRequest.findMany({
      where: {
        tenantId,
        status: RequestStatus.PENDING,
        createdAt: { lte: this.addHours(new Date(), -thresholdHours) },
      },
      take: 20,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        companyId: true,
        title: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    seeds.push(
      ...requests.map(
        (request): NotificationSeed => ({
          actionHref: '/solicitudes?estado=PENDING',
          companyId: request.companyId,
          entityId: request.id,
          entityType: 'EmployeeRequest',
          message: `${this.personName(request.employee)} espera respuesta por: ${request.title}. Lleva mas de ${thresholdHours} horas pendiente.`,
          priority: rule.priority,
          ruleKey: `request-pending:${request.id}`,
          title: 'Solicitud sin respuesta',
          type: NotificationType.REQUEST_PENDING,
        }),
      ),
    );
  }

  private async addRepeatedLateSeeds(
    tenantId: string,
    today: Date,
    rule: EnabledRule | undefined,
    seeds: NotificationSeed[],
  ) {
    if (!rule) return;

    const thresholdCount = rule.thresholdCount ?? 3;
    const windowDays = rule.windowDays ?? 7;
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        tenantId,
        status: AttendanceStatus.LATE,
        workDate: { gte: this.addDays(today, -(windowDays - 1)), lte: today },
      },
      orderBy: { workDate: 'desc' },
      take: 5_000,
      select: {
        id: true,
        companyId: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    const recordsByEmployee = new Map<string, typeof records>();

    for (const record of records) {
      recordsByEmployee.set(record.employeeId, [
        ...(recordsByEmployee.get(record.employeeId) ?? []),
        record,
      ]);
    }

    for (const [employeeId, employeeRecords] of recordsByEmployee) {
      if (employeeRecords.length < thresholdCount) continue;

      const firstRecord = employeeRecords[0];
      seeds.push({
        actionHref: '/asistencia?estado=LATE',
        companyId: firstRecord.companyId,
        entityId: employeeId,
        entityType: 'Employee',
        message: `${this.personName(firstRecord.employee)} acumula ${employeeRecords.length} tardanzas en los ultimos ${windowDays} dias.`,
        priority: rule.priority,
        ruleKey: `attendance-late-repeated:${employeeId}:${this.formatRuleDate(today)}`,
        title: 'Tardanzas repetidas',
        type: NotificationType.ATTENDANCE_LATE,
      });
    }
  }

  private documentSeedSelect() {
    return {
      id: true,
      companyId: true,
      title: true,
      expiresAt: true,
      employee: { select: { firstName: true, lastName: true } },
    };
  }

  private notificationSelect() {
    return {
      id: true,
      type: true,
      priority: true,
      status: true,
      title: true,
      message: true,
      actionHref: true,
      entityType: true,
      entityId: true,
      generatedAt: true,
      readAt: true,
      createdAt: true,
      company: { select: { id: true, name: true, slug: true } },
    };
  }

  private normalizeOptionalPriority(value: unknown) {
    const normalized = this.toOptionalString(value);
    if (!normalized) return undefined;
    if (!(normalized in NotificationPriority))
      throw new BadRequestException('La prioridad no es valida.');
    return NotificationPriority[
      normalized as keyof typeof NotificationPriority
    ];
  }

  private normalizeOptionalStatus(value: unknown) {
    const normalized = this.toOptionalString(value);
    if (!normalized) return undefined;
    if (!(normalized in NotificationStatus))
      throw new BadRequestException('El estado no es valido.');
    return NotificationStatus[normalized as keyof typeof NotificationStatus];
  }

  private normalizeOptionalType(value: unknown) {
    const normalized = this.toOptionalString(value);
    if (!normalized) return undefined;
    if (!(normalized in NotificationType))
      throw new BadRequestException('El tipo no es valido.');
    return NotificationType[normalized as keyof typeof NotificationType];
  }

  private normalizePage(value: unknown) {
    const page = Number(value ?? 1);
    return Number.isInteger(page) && page > 0 ? page : 1;
  }

  private normalizePageSize(value: unknown) {
    const pageSize = Number(value ?? 10);
    return Number.isInteger(pageSize)
      ? Math.min(Math.max(pageSize, 5), 100)
      : 10;
  }

  private startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private addHours(date: Date, hours: number) {
    const nextDate = new Date(date);
    nextDate.setHours(nextDate.getHours() + hours);
    return nextDate;
  }

  private formatDate(value: Date | null) {
    if (!value) return 'sin fecha';
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(value);
  }

  private formatRuleDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private personName(person: { firstName: string; lastName: string }) {
    return `${person.firstName} ${person.lastName}`;
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
}
