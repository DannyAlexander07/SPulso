import {
  BadRequestException,
  NotFoundException,
  Injectable,
} from '@nestjs/common';
import {
  AttendanceStatus,
  Prisma,
  RequestStatus,
  RequestType,
} from '@prisma/client';
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
} from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(
    actor: AuthUser,
    filters?: {
      companyId?: string;
      cursor?: string;
      cursorMode?: boolean;
      employeeId?: string;
      page?: string;
      pageSize?: string;
      search?: string;
      status?: string;
      type?: string;
    },
  ) {
    const where: Prisma.EmployeeRequestWhereInput = {
      tenantId: actor.tenantId,
      employee: employeeVisibilityScope(actor),
    };
    const companyId = this.toOptionalString(filters?.companyId);
    const cursor = toOptionalCursor(filters?.cursor);
    const cursorMode = filters?.cursorMode === true;
    const employeeId = this.toOptionalString(filters?.employeeId);
    const page = this.normalizePage(filters?.page);
    const pageSize = this.normalizePageSize(filters?.pageSize);
    const status = this.normalizeOptionalRequestStatus(filters?.status);
    const type = this.normalizeOptionalRequestType(filters?.type);
    const search = this.toOptionalString(filters?.search);

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

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { employee: { firstName: { contains: search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (cursor || cursorMode) {
      const items = await this.prisma.employeeRequest.findMany({
        where,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pageSize + 1,
        select: this.requestSelect(),
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
      this.prisma.employeeRequest.count({ where }),
      this.prisma.employeeRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.requestSelect(),
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
    const groupedRequests = await this.prisma.employeeRequest.groupBy({
      by: ['status'],
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
        employee: employeeVisibilityScope(actor),
      },
      _count: {
        status: true,
      },
    });

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      total: 0,
    };

    for (const item of groupedRequests) {
      counts.total += item._count.status;

      if (item.status === RequestStatus.PENDING) {
        counts.pending = item._count.status;
      }

      if (item.status === RequestStatus.APPROVED) {
        counts.approved = item._count.status;
      }

      if (item.status === RequestStatus.REJECTED) {
        counts.rejected = item._count.status;
      }

      if (item.status === RequestStatus.CANCELLED) {
        counts.cancelled = item._count.status;
      }
    }

    return counts;
  }

  async create(actor: AuthUser, createRequestDto: CreateRequestDto) {
    const tenantId = actor.tenantId;
    const employeeId = this.toOptionalString(createRequestDto.employeeId);
    const title = this.toOptionalString(createRequestDto.title);
    const startDateValue = this.toOptionalString(createRequestDto.startDate);

    if (!employeeId || !title || !startDateValue) {
      throw new BadRequestException(
        'Trabajador, titulo y fecha de inicio son obligatorios.',
      );
    }

    const type = this.normalizeRequestType(createRequestDto.type);

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId,
        ...employeeVisibilityScope(actor),
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
      },
    });

    if (!employee || employee.tenantId !== tenantId) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    const canCreateForOthers = (actor.permissions ?? []).includes(
      'requests.approve',
    );
    if (
      !canCreateForOthers &&
      (!actor.employeeId || employee.id !== actor.employeeId)
    ) {
      throw new BadRequestException(
        'Tu acceso solo permite crear solicitudes propias.',
      );
    }

    assertCompanyAccess(actor, employee.companyId);

    const startDate = new Date(startDateValue);
    const endDateValue = this.toOptionalString(createRequestDto.endDate);
    const endDate = endDateValue ? new Date(endDateValue) : startDate;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Las fechas enviadas no son validas.');
    }

    if (endDate < startDate) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha de inicio.',
      );
    }

    const request = await this.prisma.employeeRequest.create({
      data: {
        tenantId: employee.tenantId,
        companyId: employee.companyId,
        employeeId: employee.id,
        type,
        title,
        description: this.toOptionalString(createRequestDto.description),
        startDate,
        endDate,
      },
      select: this.requestSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: request.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'employee_request.created',
      entityType: 'EmployeeRequest',
      entityId: request.id,
      summary: `Se creo la solicitud ${request.title} de ${request.employee.firstName} ${request.employee.lastName}.`,
      after: this.toJson(this.auditRequestSnapshot(request)),
    });

    return request;
  }

  async decide(actor: AuthUser, id: string, status: 'APPROVED' | 'REJECTED') {
    const tenantId = actor.tenantId;
    const requestId = this.toOptionalString(id);

    if (!requestId) {
      throw new BadRequestException('La solicitud es obligatoria.');
    }

    const request = await this.prisma.employeeRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
        employee: employeeVisibilityScope(actor),
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        employeeId: true,
        type: true,
        status: true,
        title: true,
        startDate: true,
        endDate: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!request || request.tenantId !== tenantId) {
      throw new NotFoundException('La solicitud no existe.');
    }

    assertCompanyAccess(actor, request.companyId);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue atendida.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.employeeRequest.update({
        where: { id: requestId },
        data: {
          status,
          decidedAt: new Date(),
        },
        select: this.requestSelect(),
      });

      const generatedAttendance =
        status === 'APPROVED'
          ? await this.syncAttendanceForApprovedRequest(tx, request)
          : 0;

      return { generatedAttendance, updatedRequest };
    });

    const action =
      status === 'APPROVED'
        ? 'employee_request.approved'
        : 'employee_request.rejected';
    const decisionLabel = status === 'APPROVED' ? 'aprobada' : 'rechazada';

    await this.auditService.write({
      tenantId: request.tenantId,
      companyId: request.companyId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action,
      entityType: 'EmployeeRequest',
      entityId: request.id,
      summary: `Solicitud ${decisionLabel}: ${request.title} de ${request.employee.firstName} ${request.employee.lastName}.`,
      before: {
        status: 'PENDING',
      },
      after: {
        status,
        attendance:
          result.generatedAttendance > 0
            ? `${result.generatedAttendance} dia(s) actualizados`
            : 'Sin cambios',
      },
    });

    return result.updatedRequest;
  }

  private async syncAttendanceForApprovedRequest(
    tx: Prisma.TransactionClient,
    request: {
      tenantId: string;
      companyId: string;
      employeeId: string;
      type: RequestType;
      title: string;
      startDate: Date;
      endDate: Date | null;
    },
  ) {
    if (
      request.type !== RequestType.VACATION &&
      request.type !== RequestType.PERMISSION &&
      request.type !== RequestType.MEDICAL_LEAVE
    ) {
      return 0;
    }

    const dates = this.getDatesBetween(
      request.startDate,
      request.endDate ?? request.startDate,
    );

    for (const workDate of dates) {
      await tx.attendanceRecord.upsert({
        where: {
          employeeId_workDate: {
            employeeId: request.employeeId,
            workDate,
          },
        },
        update: {
          status: AttendanceStatus.ON_LEAVE,
          source: 'request',
          notes: `Solicitud aprobada: ${request.title}`,
        },
        create: {
          tenantId: request.tenantId,
          companyId: request.companyId,
          employeeId: request.employeeId,
          workDate,
          status: AttendanceStatus.ON_LEAVE,
          source: 'request',
          notes: `Solicitud aprobada: ${request.title}`,
        },
      });
    }

    return dates.length;
  }

  private getDatesBetween(startDate: Date, endDate: Date) {
    const dates: Date[] = [];
    const start = this.getStartOfDay(startDate);
    const end = this.getStartOfDay(endDate);
    const diffInDays = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays < 0) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha de inicio.',
      );
    }

    if (diffInDays > 90) {
      throw new BadRequestException(
        'Una solicitud no puede sincronizar mas de 90 dias.',
      );
    }

    for (let index = 0; index <= diffInDays; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      dates.push(date);
    }

    return dates;
  }

  private getStartOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);

    return date;
  }

  private requestSelect() {
    return {
      id: true,
      type: true,
      status: true,
      title: true,
      description: true,
      startDate: true,
      endDate: true,
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

  private auditRequestSnapshot(request: {
    id: string;
    type: RequestType;
    status: RequestStatus;
    title: string;
    description: string | null;
    startDate: Date | string;
    endDate: Date | string | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    };
    company: { id: string; name: string; slug: string };
  }) {
    return {
      id: request.id,
      title: request.title,
      type: request.type,
      status: request.status,
      description: request.description,
      startDate: new Date(request.startDate).toISOString().slice(0, 10),
      endDate: request.endDate
        ? new Date(request.endDate).toISOString().slice(0, 10)
        : null,
      employee: {
        id: request.employee.id,
        name: `${request.employee.firstName} ${request.employee.lastName}`,
      },
      company: {
        id: request.company.id,
        name: request.company.name,
      },
    };
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private normalizeRequestType(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized || !(normalized in RequestType)) {
      throw new BadRequestException('El tipo de solicitud no es valido.');
    }

    return RequestType[normalized as keyof typeof RequestType];
  }

  private normalizeOptionalRequestType(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in RequestType)) {
      throw new BadRequestException('El tipo de solicitud no es valido.');
    }

    return RequestType[normalized as keyof typeof RequestType];
  }

  private normalizeOptionalRequestStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in RequestStatus)) {
      throw new BadRequestException('El estado de solicitud no es valido.');
    }

    return RequestStatus[normalized as keyof typeof RequestStatus];
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
