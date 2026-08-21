import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  assertCompanyAccess,
  hasGlobalCompanyAccess,
} from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateAttendanceRulesDto } from './dto/update-attendance-rules.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(
    tenantId: string,
    filters?: { companyId?: string; search?: string; status?: string },
  ) {
    const where: Prisma.CompanyWhereInput = { tenantId };
    const companyId = this.toOptionalString(filters?.companyId);
    const search = this.toOptionalString(filters?.search);
    const status = this.normalizeOptionalCompanyStatus(filters?.status);

    if (companyId) {
      where.id = companyId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { ruc: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.company.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
      select: this.companySelect(),
    });
  }

  async create(actor: AuthUser, createCompanyDto: CreateCompanyDto) {
    if (!hasGlobalCompanyAccess(actor)) {
      throw new BadRequestException(
        'Solo un administrador global puede crear empresas.',
      );
    }

    const tenantId = actor.tenantId;
    const name = this.toOptionalString(createCompanyDto.name);

    if (!name) {
      throw new BadRequestException('El nombre de la empresa es obligatorio.');
    }

    const slug = this.toSlug(createCompanyDto.slug || name);

    const existingCompany = await this.prisma.company.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
      select: { id: true },
    });

    if (existingCompany) {
      throw new ConflictException(
        'Ya existe una empresa con ese identificador.',
      );
    }

    const company = await this.prisma.company.create({
      data: {
        tenantId,
        name,
        slug,
        ruc: this.toOptionalString(createCompanyDto.ruc),
      },
      select: this.companySelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'company.created',
      entityType: 'Company',
      entityId: company.id,
      summary: `Se creo la empresa ${company.name}.`,
      after: this.toJson(this.auditCompanySnapshot(company)),
    });

    return company;
  }

  async getProfile(actor: AuthUser, companyId: string) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(companyId);

    if (!id) {
      throw new BadRequestException('La empresa es obligatoria.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
      select: this.companyWithTenantSelect(),
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }

    assertCompanyAccess(actor, company.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      employeeSummary,
      attendanceSummary,
      employees,
      attendance,
      documents,
      requests,
      notifications,
      auditLogs,
    ] = await Promise.all([
      this.buildEmployeeSummary(tenantId, company.id),
      this.buildAttendanceSummary(tenantId, company.id, today),
      this.prisma.employee.findMany({
        where: { companyId: company.id, tenantId },
        orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentNumber: true,
          employeeCode: true,
          jobTitle: true,
          area: true,
          hireDate: true,
          status: true,
          company: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { companyId: company.id, tenantId, workDate: today },
        orderBy: [{ status: 'asc' }, { checkIn: 'asc' }],
        take: 10,
        select: {
          id: true,
          workDate: true,
          checkIn: true,
          checkOut: true,
          checkInLatitude: true,
          checkInLongitude: true,
          checkOutLatitude: true,
          checkOutLongitude: true,
          status: true,
          source: true,
          notes: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
          company: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.employeeDocument.findMany({
        where: { companyId: company.id, tenantId },
        orderBy: [
          { status: 'asc' },
          { expiresAt: 'asc' },
          { createdAt: 'desc' },
        ],
        take: 10,
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          fileUrl: true,
          issuedAt: true,
          expiresAt: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
          company: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.employeeRequest.findMany({
        where: { companyId: company.id, tenantId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
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
          company: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.notification.findMany({
        where: { companyId: company.id, tenantId },
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { generatedAt: 'desc' },
        ],
        take: 10,
        select: {
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
        },
      }),
      this.prisma.auditLog.findMany({
        where: { companyId: company.id, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
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
          company: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return {
      company,
      employeeSummary,
      attendanceSummary,
      employees,
      attendance,
      documents,
      requests,
      notifications,
      auditLogs,
    };
  }

  async update(
    actor: AuthUser,
    companyId: string,
    updateCompanyDto: UpdateCompanyDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(companyId);
    const name = this.toOptionalString(updateCompanyDto.name);
    const status = this.normalizeOptionalCompanyStatus(updateCompanyDto.status);

    if (!id) {
      throw new BadRequestException('La empresa es obligatoria.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
      select: this.companyWithTenantSelect(),
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }

    assertCompanyAccess(actor, company.id);
    const attendanceGeofence = this.normalizeAttendanceGeofence(
      updateCompanyDto,
      company,
    );

    const slug =
      updateCompanyDto.slug !== undefined
        ? this.toSlug(updateCompanyDto.slug || name || company.name)
        : undefined;

    if (slug && slug !== company.slug) {
      const existingCompany = await this.prisma.company.findUnique({
        where: {
          tenantId_slug: {
            tenantId,
            slug,
          },
        },
        select: { id: true },
      });

      if (existingCompany && existingCompany.id !== company.id) {
        throw new ConflictException(
          'Ya existe una empresa con ese identificador.',
        );
      }
    }

    const updatedCompany = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
        ...(updateCompanyDto.ruc !== undefined
          ? { ruc: this.toOptionalString(updateCompanyDto.ruc) }
          : {}),
        ...(updateCompanyDto.workStartTime !== undefined
          ? {
              workStartTime: this.normalizeWorkStartTime(
                updateCompanyDto.workStartTime,
              ),
            }
          : {}),
        ...(updateCompanyDto.lateToleranceMinutes !== undefined
          ? {
              lateToleranceMinutes: this.normalizeTolerance(
                updateCompanyDto.lateToleranceMinutes,
              ),
            }
          : {}),
        ...attendanceGeofence,
        ...(status ? { status } : {}),
      },
      select: this.companySelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updatedCompany.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'company.updated',
      entityType: 'Company',
      entityId: updatedCompany.id,
      summary: `Se actualizo la empresa ${updatedCompany.name}.`,
      before: this.toJson(this.auditCompanySnapshot(company)),
      after: this.toJson(this.auditCompanySnapshot(updatedCompany)),
    });

    return updatedCompany;
  }

  async updateAttendanceRules(
    actor: AuthUser,
    companyId: string,
    updateAttendanceRulesDto: UpdateAttendanceRulesDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(companyId);
    const workStartTime = this.normalizeWorkStartTime(
      updateAttendanceRulesDto.workStartTime,
    );
    const lateToleranceMinutes = this.normalizeTolerance(
      updateAttendanceRulesDto.lateToleranceMinutes,
    );

    if (!id) {
      throw new BadRequestException('La empresa es obligatoria.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        workStartTime: true,
        lateToleranceMinutes: true,
        enforceAttendanceGeofence: true,
        officeLatitude: true,
        officeLongitude: true,
        attendanceRadiusMeters: true,
      },
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }

    assertCompanyAccess(actor, company.id);
    const attendanceGeofence = this.normalizeAttendanceGeofence(
      updateAttendanceRulesDto,
      company,
    );

    const updatedCompany = await this.prisma.company.update({
      where: { id },
      data: {
        workStartTime,
        lateToleranceMinutes,
        ...attendanceGeofence,
      },
      select: this.companySelect(),
    });

    await this.auditService.write({
      tenantId: company.tenantId,
      companyId: company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'company.attendance_rules.updated',
      entityType: 'Company',
      entityId: company.id,
      summary: `Se cambio el horario de asistencia de ${company.name}.`,
      before: {
        workStartTime: company.workStartTime,
        lateToleranceMinutes: company.lateToleranceMinutes,
        enforceAttendanceGeofence: company.enforceAttendanceGeofence,
        officeLatitude: company.officeLatitude,
        officeLongitude: company.officeLongitude,
        attendanceRadiusMeters: company.attendanceRadiusMeters,
      },
      after: {
        workStartTime: updatedCompany.workStartTime,
        lateToleranceMinutes: updatedCompany.lateToleranceMinutes,
        enforceAttendanceGeofence: updatedCompany.enforceAttendanceGeofence,
        officeLatitude: updatedCompany.officeLatitude,
        officeLongitude: updatedCompany.officeLongitude,
        attendanceRadiusMeters: updatedCompany.attendanceRadiusMeters,
      },
    });

    return updatedCompany;
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      slug: true,
      ruc: true,
      workStartTime: true,
      lateToleranceMinutes: true,
      enforceAttendanceGeofence: true,
      officeLatitude: true,
      officeLongitude: true,
      attendanceRadiusMeters: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private companyWithTenantSelect() {
    return {
      id: true,
      tenantId: true,
      name: true,
      slug: true,
      ruc: true,
      workStartTime: true,
      lateToleranceMinutes: true,
      enforceAttendanceGeofence: true,
      officeLatitude: true,
      officeLongitude: true,
      attendanceRadiusMeters: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private async buildEmployeeSummary(tenantId: string, companyId: string) {
    const grouped = await this.prisma.employee.groupBy({
      by: ['status'],
      where: { companyId, tenantId },
      _count: { id: true },
    });
    const summary = {
      active: 0,
      inactive: 0,
      terminated: 0,
      total: 0,
    };

    for (const item of grouped) {
      summary.total += item._count.id;

      if (item.status === 'ACTIVE') {
        summary.active = item._count.id;
      }

      if (item.status === 'INACTIVE') {
        summary.inactive = item._count.id;
      }

      if (item.status === 'TERMINATED') {
        summary.terminated = item._count.id;
      }
    }

    return summary;
  }

  private async buildAttendanceSummary(
    tenantId: string,
    companyId: string,
    workDate: Date,
  ) {
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { companyId, tenantId, workDate },
      _count: { id: true },
    });
    const summary = {
      absent: 0,
      late: 0,
      onLeave: 0,
      present: 0,
      total: 0,
    };

    for (const item of grouped) {
      summary.total += item._count.id;

      if (item.status === 'PRESENT') {
        summary.present = item._count.id;
      }

      if (item.status === 'LATE') {
        summary.late = item._count.id;
      }

      if (item.status === 'ABSENT') {
        summary.absent = item._count.id;
      }

      if (item.status === 'ON_LEAVE') {
        summary.onLeave = item._count.id;
      }
    }

    return summary;
  }

  private actorLabel(actor: AuthUser) {
    return actor.email;
  }

  private auditCompanySnapshot(company: {
    id: string;
    name: string;
    slug: string;
    ruc: string | null;
    workStartTime: string;
    lateToleranceMinutes: number;
    enforceAttendanceGeofence: boolean;
    officeLatitude: number | null;
    officeLongitude: number | null;
    attendanceRadiusMeters: number;
    status: CompanyStatus;
  }) {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      ruc: company.ruc,
      workStartTime: company.workStartTime,
      lateToleranceMinutes: company.lateToleranceMinutes,
      enforceAttendanceGeofence: company.enforceAttendanceGeofence,
      officeLatitude: company.officeLatitude,
      officeLongitude: company.officeLongitude,
      attendanceRadiusMeters: company.attendanceRadiusMeters,
      status: company.status,
    };
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
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

  private toSlug(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      throw new BadRequestException(
        'El identificador de la empresa es obligatorio.',
      );
    }

    return normalized
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeWorkStartTime(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized || !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
      throw new BadRequestException(
        'La hora de entrada debe tener formato HH:mm.',
      );
    }

    return normalized;
  }

  private normalizeTolerance(value: unknown) {
    const minutes = Number(value);

    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) {
      throw new BadRequestException(
        'La tolerancia debe estar entre 0 y 180 minutos.',
      );
    }

    return minutes;
  }

  private normalizeAttendanceGeofence(
    value: {
      enforceAttendanceGeofence?: boolean;
      officeLatitude?: number | null;
      officeLongitude?: number | null;
      attendanceRadiusMeters?: number;
    },
    current: {
      enforceAttendanceGeofence: boolean;
      officeLatitude: number | null;
      officeLongitude: number | null;
      attendanceRadiusMeters: number;
    },
  ) {
    const enforceAttendanceGeofence =
      value.enforceAttendanceGeofence ?? current.enforceAttendanceGeofence;
    const officeLatitude =
      value.officeLatitude === undefined
        ? current.officeLatitude
        : this.normalizeCoordinate(value.officeLatitude, -90, 90, 'latitud');
    const officeLongitude =
      value.officeLongitude === undefined
        ? current.officeLongitude
        : this.normalizeCoordinate(
            value.officeLongitude,
            -180,
            180,
            'longitud',
          );
    const attendanceRadiusMeters =
      value.attendanceRadiusMeters === undefined
        ? current.attendanceRadiusMeters
        : Number(value.attendanceRadiusMeters);

    if (
      !Number.isInteger(attendanceRadiusMeters) ||
      attendanceRadiusMeters < 25 ||
      attendanceRadiusMeters > 5000
    ) {
      throw new BadRequestException(
        'El radio de marcacion debe estar entre 25 y 5000 metros.',
      );
    }

    if (
      enforceAttendanceGeofence &&
      (officeLatitude === null || officeLongitude === null)
    ) {
      throw new BadRequestException(
        'Define latitud y longitud antes de activar la zona de marcacion.',
      );
    }

    return {
      enforceAttendanceGeofence,
      officeLatitude,
      officeLongitude,
      attendanceRadiusMeters,
    };
  }

  private normalizeCoordinate(
    value: unknown,
    minimum: number,
    maximum: number,
    label: string,
  ) {
    if (value === null || value === '') {
      return null;
    }

    const coordinate = Number(value);

    if (
      !Number.isFinite(coordinate) ||
      coordinate < minimum ||
      coordinate > maximum
    ) {
      throw new BadRequestException(`La ${label} no es valida.`);
    }

    return coordinate;
  }

  private normalizeOptionalCompanyStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in CompanyStatus)) {
      throw new BadRequestException('El estado de empresa no es valido.');
    }

    return CompanyStatus[normalized as keyof typeof CompanyStatus];
  }
}
