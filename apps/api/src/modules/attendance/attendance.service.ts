import { BadRequestException, Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  performDummyPinComparison,
  verifyAttendancePinAtomically,
} from '../../security/attendance-pin-security';
import { AuditService } from '../audit/audit.service';
import {
  assertCompanyAccess,
  employeeVisibilityScope,
} from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { MarkAttendanceDto } from './dto/mark-attendance.dto';
import type { SelfMarkAttendanceDto } from './dto/self-mark-attendance.dto';

const ATTENDANCE_LIST_LIMIT = 1000;
const ATTENDANCE_RANGE_MAX_DAYS = 31;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async getSummary(actor: AuthUser, date?: string, companyId?: string) {
    const tenantId = actor.tenantId;
    const workDate = this.getWorkDate(date);
    const companyFilter = companyId ? { companyId } : {};
    const employeeScope = employeeVisibilityScope(actor);

    const [totalEmployees, groupedAttendance] = await Promise.all([
      this.prisma.employee.count({
        where: {
          tenantId,
          ...companyFilter,
          ...employeeScope,
          status: 'ACTIVE',
        },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: {
          tenantId,
          ...companyFilter,
          employee: employeeScope,
          workDate,
        },
        _count: {
          status: true,
        },
      }),
    ]);

    const counts = {
      present: 0,
      late: 0,
      absent: 0,
      onLeave: 0,
    };

    for (const item of groupedAttendance) {
      if (item.status === AttendanceStatus.PRESENT) {
        counts.present = item._count.status;
      }

      if (item.status === AttendanceStatus.LATE) {
        counts.late = item._count.status;
      }

      if (item.status === AttendanceStatus.ABSENT) {
        counts.absent = item._count.status;
      }

      if (item.status === AttendanceStatus.ON_LEAVE) {
        counts.onLeave = item._count.status;
      }
    }

    const registered =
      counts.present + counts.late + counts.absent + counts.onLeave;
    counts.absent += Math.max(totalEmployees - registered, 0);

    return {
      date: workDate.toISOString(),
      totalEmployees,
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      onLeave: counts.onLeave,
      attendanceRate:
        totalEmployees === 0
          ? 0
          : Math.round(((counts.present + counts.late) / totalEmployees) * 100),
    };
  }

  getToday(actor: AuthUser, date?: string, companyId?: string) {
    const tenantId = actor.tenantId;
    const workDate = this.getWorkDate(date);
    const employeeScope = employeeVisibilityScope(actor);

    return this.prisma.attendanceRecord.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
        employee: employeeScope,
        workDate,
      },
      orderBy: [
        { company: { name: 'asc' } },
        { employee: { firstName: 'asc' } },
      ],
      take: ATTENDANCE_LIST_LIMIT,
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
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            workStartTime: true,
            lateToleranceMinutes: true,
            enforceAttendanceGeofence: true,
            officeLatitude: true,
            officeLongitude: true,
            attendanceRadiusMeters: true,
          },
        },
      },
    });
  }

  getRange(actor: AuthUser, from?: string, to?: string, companyId?: string) {
    const tenantId = actor.tenantId;
    const { startDate, endDate } = this.getWorkDateRange(from, to);
    const employeeScope = employeeVisibilityScope(actor);
    const rangeDays =
      Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

    if (rangeDays > ATTENDANCE_RANGE_MAX_DAYS) {
      throw new BadRequestException(
        `El rango de asistencia no puede superar ${ATTENDANCE_RANGE_MAX_DAYS} dias.`,
      );
    }

    return this.prisma.attendanceRecord.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
        employee: employeeScope,
        workDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        { workDate: 'desc' },
        { company: { name: 'asc' } },
        { employee: { firstName: 'asc' } },
      ],
      take: ATTENDANCE_LIST_LIMIT,
      select: this.attendanceRecordSelect(),
    });
  }

  async mark(actor: AuthUser, markAttendanceDto: MarkAttendanceDto) {
    const tenantId = actor.tenantId;
    const employeeId = this.toOptionalString(markAttendanceDto.employeeId);

    if (!employeeId) {
      throw new BadRequestException('El trabajador es obligatorio.');
    }

    const status = this.normalizeAttendanceStatus(markAttendanceDto.status);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
      },
    });

    if (!employee || employee.tenantId !== tenantId) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    assertCompanyAccess(actor, employee.companyId);

    const workDate = this.getStartOfToday();
    const checkIn = this.parseTimeForToday(markAttendanceDto.checkIn, workDate);
    const checkOut = this.parseTimeForToday(
      markAttendanceDto.checkOut,
      workDate,
    );

    const previousRecord = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
      select: this.attendanceRecordSelect(),
    });

    const record = await this.prisma.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
      update: {
        status,
        checkIn,
        checkOut,
        notes: this.toOptionalString(markAttendanceDto.notes),
        source: 'web',
      },
      create: {
        tenantId: employee.tenantId,
        companyId: employee.companyId,
        employeeId: employee.id,
        workDate,
        status,
        checkIn,
        checkOut,
        notes: this.toOptionalString(markAttendanceDto.notes),
        source: 'web',
      },
      select: this.attendanceRecordSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: record.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: previousRecord ? 'attendance.updated' : 'attendance.created',
      entityType: 'AttendanceRecord',
      entityId: record.id,
      summary: `Se registro asistencia de ${record.employee.firstName} ${record.employee.lastName}.`,
      before: previousRecord
        ? this.toJson(this.auditAttendanceSnapshot(previousRecord))
        : undefined,
      after: this.toJson(this.auditAttendanceSnapshot(record)),
    });

    return record;
  }

  async selfMark(selfMarkAttendanceDto: SelfMarkAttendanceDto) {
    const identifier = this.toOptionalString(selfMarkAttendanceDto.identifier);
    const pin = this.toOptionalString(selfMarkAttendanceDto.pin);
    const action = this.toOptionalString(selfMarkAttendanceDto.action);
    const companyScope = await this.resolvePublicCompanyScope(
      selfMarkAttendanceDto.tenantSlug,
      selfMarkAttendanceDto.companySlug,
    );

    if (!identifier || !pin) {
      throw new BadRequestException('Ingresa tu codigo o DNI y tu PIN.');
    }

    if (action !== 'CHECK_IN' && action !== 'CHECK_OUT') {
      throw new BadRequestException('La accion de marcacion no es valida.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: companyScope.tenantId,
        companyId: companyScope.companyId,
        status: 'ACTIVE',
        OR: [{ employeeCode: identifier }, { documentNumber: identifier }],
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        attendancePinHash: true,
        attendancePinChangeRequired: true,
        attendancePinFailedAttempts: true,
        attendancePinLockedUntil: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            workStartTime: true,
            lateToleranceMinutes: true,
            enforceAttendanceGeofence: true,
            officeLatitude: true,
            officeLongitude: true,
            attendanceRadiusMeters: true,
          },
        },
      },
    });

    if (!employee) {
      await performDummyPinComparison(pin);
      throw new BadRequestException(
        'No pudimos validar tus datos de marcacion.',
      );
    }

    if (!(await verifyAttendancePinAtomically(this.prisma, employee.id, pin))) {
      throw new BadRequestException(
        'No pudimos validar tus datos de marcacion.',
      );
    }

    if (employee.attendancePinChangeRequired) {
      throw new BadRequestException(
        'Debes cambiar tu PIN temporal antes de registrar asistencia.',
      );
    }

    const workDate = this.getStartOfToday();
    const now = new Date();
    const location = this.parseLocation(
      selfMarkAttendanceDto.latitude,
      selfMarkAttendanceDto.longitude,
    );
    this.assertLocationWithinGeofence(location, employee.company);
    const currentRecord = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
    });

    if (action === 'CHECK_OUT') {
      if (!currentRecord?.checkIn) {
        throw new BadRequestException('Primero debes marcar tu entrada.');
      }

      if (currentRecord.checkOut) {
        throw new BadRequestException('Tu salida ya fue registrada hoy.');
      }

      return this.prisma.attendanceRecord.update({
        where: { id: currentRecord.id },
        data: {
          checkOut: now,
          checkOutLatitude: location?.latitude,
          checkOutLongitude: location?.longitude,
          source: 'worker',
        },
        select: this.attendanceRecordSelect(),
      });
    }

    if (currentRecord?.checkIn) {
      throw new BadRequestException('Tu entrada ya fue registrada hoy.');
    }

    const status = this.isLateCheckIn(
      now,
      employee.company.workStartTime,
      employee.company.lateToleranceMinutes,
    )
      ? AttendanceStatus.LATE
      : AttendanceStatus.PRESENT;

    return this.prisma.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
      update: {
        checkIn: now,
        checkInLatitude: location?.latitude,
        checkInLongitude: location?.longitude,
        status,
        source: 'worker',
      },
      create: {
        tenantId: employee.tenantId,
        companyId: employee.companyId,
        employeeId: employee.id,
        workDate,
        checkIn: now,
        checkInLatitude: location?.latitude,
        checkInLongitude: location?.longitude,
        status,
        source: 'worker',
      },
      select: this.attendanceRecordSelect(),
    });
  }

  private async resolvePublicCompanyScope(
    tenantSlugValue: unknown,
    companySlugValue: unknown,
  ) {
    const tenantSlug = this.normalizePublicSlug(tenantSlugValue, 'El tenant');
    const companySlug = this.normalizePublicSlug(
      companySlugValue,
      'La empresa',
    );

    if (!companySlug) {
      throw new BadRequestException(
        'Selecciona la empresa para marcar asistencia.',
      );
    }

    const where: Prisma.CompanyWhereInput = tenantSlug
      ? { slug: companySlug, tenant: { slug: tenantSlug } }
      : { slug: companySlug };

    const companies = await this.prisma.company.findMany({
      where,
      take: 2,
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (companies.length !== 1) {
      throw new BadRequestException(
        'No pudimos validar la empresa seleccionada.',
      );
    }

    return {
      tenantId: companies[0].tenantId,
      companyId: companies[0].id,
    };
  }

  private normalizePublicSlug(value: unknown, label: string) {
    const normalized = this.toOptionalString(value)?.toLowerCase() ?? null;

    if (!normalized) {
      return null;
    }

    if (!/^[a-z0-9-]{2,80}$/.test(normalized)) {
      throw new BadRequestException(`${label} no es valido.`);
    }

    return normalized;
  }

  private getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return today;
  }

  private getWorkDate(value?: string) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return this.getStartOfToday();
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD.');
    }

    const date = new Date(`${normalized}T00:00:00.000`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha enviada no es valida.');
    }

    return date;
  }

  private getWorkDateRange(from?: string, to?: string) {
    const endDate = this.getWorkDate(to);
    const startDate = this.getWorkDate(
      from ?? this.toInputDate(this.addDays(endDate, -6)),
    );
    const diffInDays = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays < 0) {
      throw new BadRequestException(
        'La fecha inicial no puede ser mayor que la fecha final.',
      );
    }

    if (diffInDays > 90) {
      throw new BadRequestException(
        'El reporte puede consultar como maximo 90 dias.',
      );
    }

    return { startDate, endDate };
  }

  private addDays(value: Date, days: number) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);

    return date;
  }

  private toInputDate(value: Date) {
    const offset = value.getTimezoneOffset();
    const localDate = new Date(value.getTime() - offset * 60 * 1000);

    return localDate.toISOString().slice(0, 10);
  }

  private isLateCheckIn(
    value: Date,
    workStartTime = '09:00',
    toleranceMinutes = 15,
  ) {
    const lateLimit = new Date(value);
    const [hours, minutes] = workStartTime.split(':').map(Number);

    lateLimit.setHours(
      Number.isNaN(hours) ? 9 : hours,
      (Number.isNaN(minutes) ? 0 : minutes) + toleranceMinutes,
      0,
      0,
    );

    return value > lateLimit;
  }

  private attendanceRecordSelect() {
    return {
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

  private auditAttendanceSnapshot(record: {
    id: string;
    workDate: Date | string;
    checkIn: Date | string | null;
    checkOut: Date | string | null;
    status: AttendanceStatus;
    source: string;
    notes: string | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    };
    company: { id: string; name: string; slug: string };
  }) {
    return {
      id: record.id,
      workDate: new Date(record.workDate).toISOString().slice(0, 10),
      checkIn: record.checkIn ? new Date(record.checkIn).toISOString() : null,
      checkOut: record.checkOut
        ? new Date(record.checkOut).toISOString()
        : null,
      status: record.status,
      source: record.source,
      notes: record.notes,
      employee: {
        id: record.employee.id,
        name: `${record.employee.firstName} ${record.employee.lastName}`,
      },
      company: {
        id: record.company.id,
        name: record.company.name,
      },
    };
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private normalizeAttendanceStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized || !(normalized in AttendanceStatus)) {
      throw new BadRequestException('El estado de asistencia no es valido.');
    }

    return AttendanceStatus[normalized as keyof typeof AttendanceStatus];
  }

  private parseTimeForToday(value: unknown, workDate: Date) {
    const time = this.toOptionalString(value);

    if (!time) {
      return null;
    }

    const [hours, minutes] = time.split(':').map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      throw new BadRequestException('La hora enviada no es valida.');
    }

    const date = new Date(workDate);
    date.setHours(hours, minutes, 0, 0);

    return date;
  }

  private parseLocation(latitude: unknown, longitude: unknown) {
    if (
      latitude === null ||
      latitude === undefined ||
      longitude === null ||
      longitude === undefined
    ) {
      throw new BadRequestException(
        'La ubicacion GPS es obligatoria para marcar asistencia.',
      );
    }

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (
      Number.isNaN(parsedLatitude) ||
      Number.isNaN(parsedLongitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      throw new BadRequestException('La ubicacion enviada no es valida.');
    }

    return {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    };
  }

  private assertLocationWithinGeofence(
    location: { latitude: number; longitude: number },
    company: {
      enforceAttendanceGeofence: boolean;
      officeLatitude: number | null;
      officeLongitude: number | null;
      attendanceRadiusMeters: number;
    },
  ) {
    if (!company.enforceAttendanceGeofence) {
      return;
    }

    if (company.officeLatitude === null || company.officeLongitude === null) {
      throw new BadRequestException(
        'La empresa no tiene una ubicacion de marcacion configurada.',
      );
    }

    const distance = this.distanceInMeters(
      location.latitude,
      location.longitude,
      company.officeLatitude,
      company.officeLongitude,
    );

    if (distance > company.attendanceRadiusMeters) {
      throw new BadRequestException(
        `Estas fuera de la zona autorizada de marcacion (${Math.round(distance)} m).`,
      );
    }
  }

  private distanceInMeters(
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number,
  ) {
    const earthRadiusMeters = 6_371_000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latitudeDelta = toRadians(latitudeB - latitudeA);
    const longitudeDelta = toRadians(longitudeB - longitudeA);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(latitudeA)) *
        Math.cos(toRadians(latitudeB)) *
        Math.sin(longitudeDelta / 2) ** 2;

    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
