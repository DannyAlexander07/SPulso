import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPaginationMeta,
  sliceCursorPage,
  toOptionalCursor,
} from '../../common/pagination';
import { PrismaService } from '../../database/prisma.service';

type WriteAuditLogInput = {
  tenantId: string;
  companyId?: string | null;
  actorType: string;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecent(
    tenantId: string,
    filters?: {
      actorType?: string;
      companyId?: string;
      cursor?: string;
      cursorMode?: boolean;
      from?: string;
      page?: string;
      pageSize?: string;
      search?: string;
      to?: string;
    },
  ) {
    const where: Prisma.AuditLogWhereInput = { tenantId };
    const actorType = this.toOptionalString(filters?.actorType);
    const companyId = this.toOptionalString(filters?.companyId);
    const cursor = toOptionalCursor(filters?.cursor);
    const cursorMode = filters?.cursorMode === true;
    const from = this.parseOptionalDate(filters?.from, 'start');
    const page = this.normalizePage(filters?.page);
    const pageSize = this.normalizePageSize(filters?.pageSize);
    const search = this.toOptionalString(filters?.search);
    const to = this.parseOptionalDate(filters?.to, 'end');

    if (actorType) {
      where.actorType = actorType;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    if (search) {
      where.OR = [
        { actorLabel: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const select = {
      id: true,
      actorType: true,
      actorLabel: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      before: true,
      after: true,
      createdAt: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    };

    if (cursor || cursorMode) {
      const items = await this.prisma.auditLog.findMany({
        where,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pageSize + 1,
        select,
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
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select,
      }),
    ]);

    return {
      data,
      meta: {
        ...buildPaginationMeta({ page, pageSize, total }),
      },
    };
  }

  write(input: WriteAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId ?? null,
        actorType: input.actorType,
        actorLabel: input.actorLabel,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
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

  private parseOptionalDate(value: unknown, boundary: 'start' | 'end') {
    const normalized = this.toOptionalString(value);

    if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return null;
    }

    const date = new Date(`${normalized}T00:00:00.000`);

    if (boundary === 'end') {
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
    const pageSize = Number(value ?? 20);

    if (!Number.isInteger(pageSize)) {
      return 20;
    }

    return Math.min(Math.max(pageSize, 10), 100);
  }
}
