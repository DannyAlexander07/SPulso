import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  EmployeeStatus,
  ExportJobStatus,
  ExportJobType,
  Prisma,
  RequestStatus,
  RequestType,
  UserStatus,
} from '@prisma/client';
import { appendFile, mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../database/prisma.service';
import { FileStorageService } from '../../storage/file-storage.service';
import { AuditService } from '../audit/audit.service';
import {
  assertCompanyAccess,
  hasGlobalCompanyAccess,
  scopedCompanyId,
} from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { CreateExportJobDto } from './dto/create-export-job.dto';

const EXPORT_BATCH_SIZE = 500;
const EXPORT_STORAGE_PREFIX = 'exportaciones';
const EXPORT_TMP_DIR = join(process.cwd(), 'uploads', 'tmp', 'exportaciones');

type ExportFilters = Record<string, unknown>;

type CsvColumn<T> = {
  header: string;
  value: (item: T) => string;
};

type CsvRow = { id: string };

type EmployeeCsvRow = CsvRow & {
  area: string | null;
  areaRef: { name: string } | null;
  company: { name: string } | null;
  documentNumber: string | null;
  employeeCode: string | null;
  firstName: string;
  jobTitle: string | null;
  lastName: string;
  position: { name: string } | null;
  status: EmployeeStatus;
  team: { name: string } | null;
};

type DocumentCsvRow = CsvRow & {
  company: { name: string } | null;
  employee: { firstName: string; lastName: string };
  expiresAt: Date | null;
  fileUrl: string | null;
  issuedAt: Date | null;
  status: DocumentStatus;
  title: string;
  type: DocumentType;
};

type RequestCsvRow = CsvRow & {
  company: { name: string } | null;
  description: string | null;
  employee: { firstName: string; lastName: string };
  endDate: Date | null;
  startDate: Date | null;
  status: RequestStatus;
  title: string;
  type: RequestType;
};

type UserCsvRow = CsvRow & {
  company: { name: string } | null;
  createdAt: Date;
  email: string;
  firstName: string;
  lastName: string;
  role: { name: string } | null;
  status: UserStatus;
};

@Injectable()
export class ExportJobsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly fileStorage: FileStorageService,
    private readonly prisma: PrismaService,
  ) {}

  findAll(actor: AuthUser) {
    return this.prisma.exportJob.findMany({
      where: this.jobScope(actor),
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: this.exportJobSelect(),
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const jobId = this.requireText(id, 'La exportacion es obligatoria.');
    const job = await this.prisma.exportJob.findFirst({
      where: { id: jobId, ...this.jobScope(actor) },
      select: this.exportJobSelect(),
    });

    if (!job) {
      throw new NotFoundException('La exportacion no existe.');
    }

    return job;
  }

  async create(actor: AuthUser, dto: CreateExportJobDto) {
    const type = this.normalizeType(dto?.type);
    this.assertTypePermission(actor, type);
    const filters = this.normalizeFilters(dto?.filters);
    const companyId = this.resolveCompanyScope(actor, filters);

    const job = await this.prisma.exportJob.create({
      data: {
        tenantId: actor.tenantId,
        companyId,
        requestedById: actor.sub,
        type,
        filters: this.toJson(filters),
      },
      select: this.exportJobSelect(),
    });

    await this.auditService.write({
      tenantId: actor.tenantId,
      companyId,
      actorType: 'user',
      actorLabel: actor.email,
      action: 'export_job.created',
      entityType: 'ExportJob',
      entityId: job.id,
      summary: `Se solicito la exportacion ${this.typeLabel(type)}.`,
      after: this.toJson({ filters, type }),
    });

    return job;
  }

  async getDownload(actor: AuthUser, id: string) {
    const jobId = this.requireText(id, 'La exportacion es obligatoria.');
    const job = await this.prisma.exportJob.findFirst({
      where: {
        id: jobId,
        status: ExportJobStatus.COMPLETED,
        ...this.jobScope(actor),
      },
      select: { fileName: true, filePath: true },
    });

    if (!job?.fileName || !job.filePath) {
      return null;
    }

    const file = await this.fileStorage.openFile(job.filePath);

    return {
      contentType: file.contentType,
      fileName: job.fileName,
      stream: file.stream,
    };
  }

  async claimNextPendingJobId() {
    const staleBefore = new Date(Date.now() - this.processingTimeoutMs());

    await this.prisma.exportJob.updateMany({
      where: {
        startedAt: { lt: staleBefore },
        status: ExportJobStatus.PROCESSING,
      },
      data: {
        errorMessage: 'El worker anterior no termino el reporte. Reintentando.',
        startedAt: null,
        status: ExportJobStatus.PENDING,
      },
    });

    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH next_job AS (
        SELECT "id"
        FROM "ExportJob"
        WHERE "status" = 'PENDING'::"ExportJobStatus"
        ORDER BY "createdAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "ExportJob" AS job
      SET
        "errorMessage" = NULL,
        "startedAt" = NOW(),
        "status" = 'PROCESSING'::"ExportJobStatus",
        "updatedAt" = NOW()
      FROM next_job
      WHERE job."id" = next_job."id"
      RETURNING job."id"
    `;

    return claimed[0]?.id ?? null;
  }

  async processNextPendingJob() {
    const jobId = await this.claimNextPendingJobId();

    if (!jobId) {
      return false;
    }

    await this.processJob(jobId);
    return true;
  }

  async processPendingJobs(limit = 10) {
    let processed = 0;

    for (let index = 0; index < limit; index += 1) {
      const didProcess = await this.processNextPendingJob();

      if (!didProcess) {
        break;
      }

      processed += 1;
    }

    return processed;
  }

  async cleanupExpiredFiles(retentionDays = this.retentionDays()) {
    if (retentionDays <= 0) {
      return 0;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const jobs = await this.prisma.exportJob.findMany({
      where: {
        completedAt: { lt: cutoff },
        filePath: { not: null },
        status: ExportJobStatus.COMPLETED,
      },
      take: 100,
      select: { id: true, filePath: true },
    });

    for (const job of jobs) {
      if (job.filePath) {
        await this.fileStorage.deleteFile(job.filePath);
      }

      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          errorMessage: 'El archivo expiro por politica de retencion.',
          fileName: null,
          filePath: null,
        },
      });
    }

    return jobs.length;
  }

  async metrics() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      statusGroups,
      typeGroups,
      oldestPending,
      failedLast24Hours,
      completedLast24Hours,
    ] = await Promise.all([
      this.prisma.exportJob.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.exportJob.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
      this.prisma.exportJob.findFirst({
        where: { status: ExportJobStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, id: true },
      }),
      this.prisma.exportJob.count({
        where: {
          completedAt: { gte: last24Hours },
          status: ExportJobStatus.FAILED,
        },
      }),
      this.prisma.exportJob.count({
        where: {
          completedAt: { gte: last24Hours },
          status: ExportJobStatus.COMPLETED,
        },
      }),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(ExportJobStatus).map((status) => [status, 0]),
    ) as Record<ExportJobStatus, number>;
    const byType = Object.fromEntries(
      Object.values(ExportJobType).map((type) => [type, 0]),
    ) as Record<ExportJobType, number>;

    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }

    for (const group of typeGroups) {
      byType[group.type] = group._count._all;
    }

    return {
      exportJobs: {
        byStatus,
        byType,
        last24Hours: {
          completed: completedLast24Hours,
          failed: failedLast24Hours,
        },
        pending: {
          oldestAgeMs: oldestPending
            ? Date.now() - oldestPending.createdAt.getTime()
            : 0,
          oldestCreatedAt: oldestPending?.createdAt.toISOString() ?? null,
          oldestJobId: oldestPending?.id ?? null,
        },
        storage: {
          driver: this.fileStorage.currentDriver(),
          retentionDays: this.retentionDays(),
        },
        worker: {
          apiWorkerEnabled: process.env.EXPORT_JOBS_API_WORKER !== 'false',
          batchSize: Number(process.env.EXPORT_JOBS_WORKER_BATCH_SIZE ?? 5),
          intervalMs: Number(process.env.EXPORT_JOBS_WORKER_INTERVAL_MS ?? 500),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async processJob(jobId: string) {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        status: true,
        type: true,
        filters: true,
        requestedBy: { select: { email: true } },
      },
    });

    if (!job) {
      return;
    }

    if (job.status !== ExportJobStatus.PROCESSING) {
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          errorMessage: null,
          startedAt: new Date(),
          status: ExportJobStatus.PROCESSING,
        },
      });
    }

    try {
      await mkdir(EXPORT_TMP_DIR, { recursive: true });
      const fileName = this.fileName(job.type);
      const storageKey = `${EXPORT_STORAGE_PREFIX}/${job.id}.csv`;
      const temporaryPath = join(EXPORT_TMP_DIR, `${job.id}.csv`);
      const rowCount = await this.writeCsv(job, temporaryPath);
      const filePath = await this.fileStorage.storeFile({
        contentType: 'text/csv; charset=utf-8',
        key: storageKey,
        sourcePath: temporaryPath,
      });
      await unlink(temporaryPath).catch(() => undefined);

      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          completedAt: new Date(),
          fileName,
          filePath,
          rowCount,
          status: ExportJobStatus.COMPLETED,
        },
      });

      await this.auditService.write({
        tenantId: job.tenantId,
        companyId: job.companyId,
        actorType: 'system',
        actorLabel: 'SPulso',
        action: 'export_job.completed',
        entityType: 'ExportJob',
        entityId: job.id,
        summary: `La exportacion ${this.typeLabel(job.type)} quedo lista con ${rowCount} filas.`,
        after: this.toJson({ rowCount, type: job.type }),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo generar la exportacion.';
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          completedAt: new Date(),
          errorMessage: message.slice(0, 500),
          status: ExportJobStatus.FAILED,
        },
      });
    }
  }

  private async writeCsv(
    job: {
      companyId: string | null;
      filters: Prisma.JsonValue | null;
      id: string;
      tenantId: string;
      type: ExportJobType;
    },
    absolutePath: string,
  ) {
    if (job.type === ExportJobType.EMPLOYEES) {
      return this.writeEmployeeCsv(job, absolutePath);
    }

    if (job.type === ExportJobType.DOCUMENTS) {
      return this.writeDocumentCsv(job, absolutePath);
    }

    if (job.type === ExportJobType.REQUESTS) {
      return this.writeRequestCsv(job, absolutePath);
    }

    return this.writeUserCsv(job, absolutePath);
  }

  private async writeEmployeeCsv(
    job: {
      companyId: string | null;
      filters: Prisma.JsonValue | null;
      tenantId: string;
    },
    absolutePath: string,
  ) {
    const filters = this.filtersFromJson(job.filters);
    const where: Prisma.EmployeeWhereInput = {
      tenantId: job.tenantId,
      ...(job.companyId ? { companyId: job.companyId } : {}),
    };
    const status = this.normalizeOptionalEnum(filters.status, EmployeeStatus);
    const search = this.toOptionalString(filters.search);

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
        { area: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.writeBatchedCsv<EmployeeCsvRow>({
      absolutePath,
      columns: [
        { header: 'Nombres', value: (item) => item.firstName },
        { header: 'Apellidos', value: (item) => item.lastName },
        { header: 'DNI', value: (item) => item.documentNumber ?? '' },
        { header: 'Codigo', value: (item) => item.employeeCode ?? '' },
        { header: 'Empresa', value: (item) => item.company?.name ?? '' },
        {
          header: 'Area',
          value: (item) => item.areaRef?.name ?? item.area ?? '',
        },
        {
          header: 'Cargo',
          value: (item) => item.position?.name ?? item.jobTitle ?? '',
        },
        { header: 'Equipo', value: (item) => item.team?.name ?? '' },
        { header: 'Estado', value: (item) => item.status },
      ],
      getBatch: (cursor) =>
        this.prisma.employee.findMany({
          where,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: EXPORT_BATCH_SIZE,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentNumber: true,
            employeeCode: true,
            area: true,
            jobTitle: true,
            status: true,
            company: { select: { name: true } },
            areaRef: { select: { name: true } },
            position: { select: { name: true } },
            team: { select: { name: true } },
          },
        }),
    });
  }

  private async writeDocumentCsv(
    job: {
      companyId: string | null;
      filters: Prisma.JsonValue | null;
      tenantId: string;
    },
    absolutePath: string,
  ) {
    const filters = this.filtersFromJson(job.filters);
    const where: Prisma.EmployeeDocumentWhereInput = {
      tenantId: job.tenantId,
      ...(job.companyId ? { companyId: job.companyId } : {}),
    };
    const employeeId = this.toOptionalString(filters.employeeId);
    const status = this.normalizeOptionalEnum(filters.status, DocumentStatus);
    const type = this.normalizeOptionalEnum(filters.type, DocumentType);
    const search = this.toOptionalString(filters.search);

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { employee: { firstName: { contains: search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.writeBatchedCsv<DocumentCsvRow>({
      absolutePath,
      columns: [
        { header: 'Titulo', value: (item) => item.title },
        { header: 'Tipo', value: (item) => item.type },
        { header: 'Estado', value: (item) => item.status },
        {
          header: 'Trabajador',
          value: (item) =>
            `${item.employee.firstName} ${item.employee.lastName}`,
        },
        { header: 'Empresa', value: (item) => item.company?.name ?? '' },
        { header: 'Emision', value: (item) => this.formatDate(item.issuedAt) },
        {
          header: 'Vencimiento',
          value: (item) => this.formatDate(item.expiresAt),
        },
        { header: 'Archivo', value: (item) => item.fileUrl ?? '' },
      ],
      getBatch: (cursor) =>
        this.prisma.employeeDocument.findMany({
          where,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: EXPORT_BATCH_SIZE,
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            fileUrl: true,
            issuedAt: true,
            expiresAt: true,
            company: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        }),
    });
  }

  private async writeRequestCsv(
    job: {
      companyId: string | null;
      filters: Prisma.JsonValue | null;
      tenantId: string;
    },
    absolutePath: string,
  ) {
    const filters = this.filtersFromJson(job.filters);
    const where: Prisma.EmployeeRequestWhereInput = {
      tenantId: job.tenantId,
      ...(job.companyId ? { companyId: job.companyId } : {}),
    };
    const employeeId = this.toOptionalString(filters.employeeId);
    const status = this.normalizeOptionalEnum(filters.status, RequestStatus);
    const type = this.normalizeOptionalEnum(filters.type, RequestType);
    const search = this.toOptionalString(filters.search);

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { employee: { firstName: { contains: search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.writeBatchedCsv<RequestCsvRow>({
      absolutePath,
      columns: [
        { header: 'Titulo', value: (item) => item.title },
        { header: 'Tipo', value: (item) => item.type },
        { header: 'Estado', value: (item) => item.status },
        {
          header: 'Trabajador',
          value: (item) =>
            `${item.employee.firstName} ${item.employee.lastName}`,
        },
        { header: 'Empresa', value: (item) => item.company?.name ?? '' },
        { header: 'Inicio', value: (item) => this.formatDate(item.startDate) },
        { header: 'Fin', value: (item) => this.formatDate(item.endDate) },
        { header: 'Descripcion', value: (item) => item.description ?? '' },
      ],
      getBatch: (cursor) =>
        this.prisma.employeeRequest.findMany({
          where,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: EXPORT_BATCH_SIZE,
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            description: true,
            startDate: true,
            endDate: true,
            company: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        }),
    });
  }

  private async writeUserCsv(
    job: {
      companyId: string | null;
      filters: Prisma.JsonValue | null;
      tenantId: string;
    },
    absolutePath: string,
  ) {
    const filters = this.filtersFromJson(job.filters);
    const where: Prisma.UserWhereInput = {
      tenantId: job.tenantId,
      ...(job.companyId ? { companyId: job.companyId } : {}),
    };
    const roleId = this.toOptionalString(filters.roleId);
    const status = this.normalizeOptionalEnum(filters.status, UserStatus);
    const search = this.toOptionalString(filters.search);

    if (roleId) where.roleId = roleId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { role: { name: { contains: search, mode: 'insensitive' } } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.writeBatchedCsv<UserCsvRow>({
      absolutePath,
      columns: [
        { header: 'Nombres', value: (item) => item.firstName },
        { header: 'Apellidos', value: (item) => item.lastName },
        { header: 'Correo', value: (item) => item.email },
        { header: 'Rol', value: (item) => item.role?.name ?? 'Sin rol' },
        {
          header: 'Empresa',
          value: (item) => item.company?.name ?? 'Grupo completo',
        },
        { header: 'Estado', value: (item) => item.status },
        { header: 'Creado', value: (item) => this.formatDate(item.createdAt) },
      ],
      getBatch: (cursor) =>
        this.prisma.user.findMany({
          where,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: EXPORT_BATCH_SIZE,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            createdAt: true,
            company: { select: { name: true } },
            role: { select: { name: true } },
          },
        }),
    });
  }

  private async writeBatchedCsv<T extends CsvRow>({
    absolutePath,
    columns,
    getBatch,
  }: {
    absolutePath: string;
    columns: Array<CsvColumn<T>>;
    getBatch: (cursor?: string) => Promise<T[]>;
  }) {
    await writeFile(
      absolutePath,
      `\uFEFF${columns.map((column) => this.escapeCsvValue(column.header)).join(';')}\n`,
    );

    let cursor: string | undefined;
    let rowCount = 0;

    for (;;) {
      const batch = await getBatch(cursor);
      if (batch.length === 0) break;

      const csv = batch
        .map((item) =>
          columns
            .map((column) => this.escapeCsvValue(column.value(item)))
            .join(';'),
        )
        .join('\n');
      await appendFile(absolutePath, `${csv}\n`);

      rowCount += batch.length;
      cursor = batch[batch.length - 1]?.id;

      if (batch.length < EXPORT_BATCH_SIZE) break;
    }

    return rowCount;
  }

  private jobScope(actor: AuthUser): Prisma.ExportJobWhereInput {
    if (hasGlobalCompanyAccess(actor)) {
      return { tenantId: actor.tenantId, requestedById: actor.sub };
    }

    if (!actor.companyId) {
      throw new ForbiddenException('Tu usuario no tiene empresa asignada.');
    }

    return {
      tenantId: actor.tenantId,
      companyId: actor.companyId,
      requestedById: actor.sub,
    };
  }

  private resolveCompanyScope(actor: AuthUser, filters: ExportFilters) {
    const requestedCompanyId = this.toOptionalString(filters.companyId);
    return scopedCompanyId(actor, requestedCompanyId) ?? null;
  }

  private assertTypePermission(actor: AuthUser, type: ExportJobType) {
    const permissions = actor.permissions ?? [];
    const requiredPermission = {
      [ExportJobType.DOCUMENTS]: 'documents.view',
      [ExportJobType.EMPLOYEES]: 'employees.view',
      [ExportJobType.REQUESTS]: 'requests.view',
      [ExportJobType.USERS]: 'users.manage',
    }[type];

    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        'No tienes permisos para generar esta exportacion.',
      );
    }

    if (!hasGlobalCompanyAccess(actor) && type === ExportJobType.USERS) {
      assertCompanyAccess(actor, actor.companyId);
    }
  }

  private normalizeType(value: unknown) {
    const normalized = this.requireText(
      value,
      'El tipo de exportacion es obligatorio.',
    );

    if (!(normalized in ExportJobType)) {
      throw new BadRequestException('El tipo de exportacion no es valido.');
    }

    return ExportJobType[normalized as keyof typeof ExportJobType];
  }

  private normalizeFilters(value: unknown): ExportFilters {
    if (value === null || value === undefined) {
      return {};
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(
        'Los filtros de exportacion no son validos.',
      );
    }

    return value as ExportFilters;
  }

  private filtersFromJson(value: Prisma.JsonValue | null): ExportFilters {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  }

  private normalizeOptionalEnum<T extends Record<string, string>>(
    value: unknown,
    source: T,
  ) {
    const normalized = this.toOptionalString(value);
    if (!normalized) return undefined;
    return normalized in source ? source[normalized as keyof T] : undefined;
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

  private requireText(value: unknown, message: string) {
    const normalized = this.toOptionalString(value);
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private exportJobSelect() {
    return {
      id: true,
      type: true,
      status: true,
      filters: true,
      fileName: true,
      rowCount: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      company: { select: { id: true, name: true, slug: true } },
      requestedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    };
  }

  private fileName(type: ExportJobType) {
    return `spulso-${this.typeSlug(type)}-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  private typeSlug(type: ExportJobType) {
    return {
      [ExportJobType.DOCUMENTS]: 'documentos',
      [ExportJobType.EMPLOYEES]: 'trabajadores',
      [ExportJobType.REQUESTS]: 'solicitudes',
      [ExportJobType.USERS]: 'usuarios',
    }[type];
  }

  private typeLabel(type: ExportJobType) {
    return {
      [ExportJobType.DOCUMENTS]: 'de documentos',
      [ExportJobType.EMPLOYEES]: 'de trabajadores',
      [ExportJobType.REQUESTS]: 'de solicitudes',
      [ExportJobType.USERS]: 'de usuarios',
    }[type];
  }

  private formatDate(value: Date | null) {
    return value ? value.toISOString().slice(0, 10) : '';
  }

  private escapeCsvValue(value: string) {
    const safeValue = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private processingTimeoutMs() {
    return Number(process.env.EXPORT_JOBS_PROCESSING_TIMEOUT_MS ?? 15 * 60_000);
  }

  private retentionDays() {
    return Number(process.env.EXPORT_JOBS_FILE_RETENTION_DAYS ?? 30);
  }
}
