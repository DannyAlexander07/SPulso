import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  EmployeeStatus,
  EmployeeTimelineEventType,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import {
  performDummyPinComparison,
  verifyAttendancePinAtomically,
} from '../../security/attendance-pin-security';
import {
  buildPaginationMeta,
  sliceCursorPage,
  toOptionalCursor,
} from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import {
  assertCompanyAccess,
  employeeVisibilityScope,
} from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { SelfUpdateAttendancePinDto } from './dto/self-update-attendance-pin.dto';
import type { TransferEmployeeDto } from './dto/transfer-employee.dto';
import type { UpdateAttendancePinDto } from './dto/update-attendance-pin.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';

type TimelineEmployeeSource = {
  id: string;
  tenantId?: string;
  companyId?: string;
  areaId?: string | null;
  positionId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  firstName: string;
  lastName: string;
  documentNumber: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  area: string | null;
  hireDate: Date | string | null;
  terminatedAt?: Date | string | null;
  terminationReason?: string | null;
  status: EmployeeStatus;
  createdAt?: Date | string;
  company: { id: string; name: string; slug: string };
  areaRef?: { id: string; name: string; slug: string } | null;
  position?: { id: string; name: string; slug: string } | null;
  team?: { id: string; name: string; slug: string } | null;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
  } | null;
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    actor: AuthUser,
    filters?: {
      companyId?: string;
      cursor?: string;
      cursorMode?: boolean;
      page?: string;
      pageSize?: string;
      search?: string;
      status?: string;
    },
  ) {
    const where: Prisma.EmployeeWhereInput = {
      tenantId: actor.tenantId,
      ...employeeVisibilityScope(actor),
    };
    const companyId = this.toOptionalString(filters?.companyId);
    const cursor = toOptionalCursor(filters?.cursor);
    const cursorMode = filters?.cursorMode === true;
    const page = this.normalizePage(filters?.page);
    const pageSize = this.normalizePageSize(filters?.pageSize);
    const search = this.toOptionalString(filters?.search);
    const status = this.normalizeOptionalEmployeeStatus(filters?.status);

    if (companyId) {
      where.companyId = companyId;
    }

    if (status) {
      where.status = status;
    }

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

    if (cursor || cursorMode) {
      const items = await this.prisma.employee.findMany({
        where,
        orderBy: [
          { company: { name: 'asc' } },
          { firstName: 'asc' },
          { id: 'asc' },
        ],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: pageSize + 1,
        select: this.employeeSelect(),
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
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        orderBy: [
          { company: { name: 'asc' } },
          { firstName: 'asc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.employeeSelect(),
      }),
    ]);

    return {
      data,
      meta: {
        ...buildPaginationMeta({ page, pageSize, total }),
      },
    };
  }

  async create(actor: AuthUser, createEmployeeDto: CreateEmployeeDto) {
    const tenantId = actor.tenantId;
    const companyId = this.toOptionalString(createEmployeeDto.companyId);
    const areaId = this.toOptionalString(createEmployeeDto.areaId);
    const positionId = this.toOptionalString(createEmployeeDto.positionId);
    const teamId = this.toOptionalString(createEmployeeDto.teamId);
    const managerId = this.toOptionalString(createEmployeeDto.managerId);
    const firstName = this.toOptionalString(createEmployeeDto.firstName);
    const lastName = this.toOptionalString(createEmployeeDto.lastName);

    if (!companyId || !firstName || !lastName) {
      throw new BadRequestException(
        'Empresa, nombres y apellidos son obligatorios.',
      );
    }

    this.assertPersonName(firstName, 'El nombre');
    this.assertPersonName(lastName, 'El apellido');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }

    assertCompanyAccess(actor, companyId);

    await this.assertOptionalArea(tenantId, companyId, areaId);
    await this.assertOptionalPosition(tenantId, companyId, positionId);
    await this.assertOptionalTeam(tenantId, companyId, teamId);
    await this.assertOptionalManager(tenantId, companyId, managerId);

    let employeeCode = this.normalizeOptionalCode(
      createEmployeeDto.employeeCode,
      'El codigo de trabajador',
    );
    const documentNumber = this.normalizeOptionalDocumentNumber(
      createEmployeeDto.documentNumber,
    );
    const personalEmail = this.normalizeOptionalEmail(
      createEmployeeDto.personalEmail,
    );
    const phoneMobile = this.normalizeOptionalPhone(
      createEmployeeDto.phoneMobile,
    );
    const address = this.normalizeOptionalLabel(createEmployeeDto.address, 240);
    const attendancePin = this.normalizeAttendancePin(
      createEmployeeDto.attendancePin,
    );
    const hireDate = this.normalizeOptionalDate(createEmployeeDto.hireDate);

    if (!employeeCode) {
      employeeCode = await this.generateEmployeeCode(companyId);
    }

    await this.assertUniqueDocumentNumber(tenantId, documentNumber);
    await this.assertUniquePersonalEmail(tenantId, personalEmail);

    if (employeeCode) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: {
          companyId_employeeCode: {
            companyId,
            employeeCode,
          },
        },
        select: { id: true },
      });

      if (existingEmployee) {
        throw new ConflictException(
          'Ya existe un trabajador con ese codigo en la empresa.',
        );
      }
    }

    const employee = await this.prisma.employee.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        areaId,
        positionId,
        teamId,
        managerId,
        firstName,
        lastName,
        documentNumber,
        personalEmail,
        phoneMobile,
        address,
        employeeCode,
        attendancePinHash: await bcrypt.hash(attendancePin, 10),
        attendancePinChangeRequired: true,
        attendancePinFailedAttempts: 0,
        attendancePinLockedUntil: null,
        jobTitle: this.normalizeOptionalLabel(createEmployeeDto.jobTitle, 90),
        area: this.normalizeOptionalLabel(createEmployeeDto.area, 80),
        hireDate,
      },
      select: this.employeeSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: employee.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'employee.created',
      entityType: 'Employee',
      entityId: employee.id,
      summary: `Se creo el trabajador ${employee.firstName} ${employee.lastName}.`,
      after: this.toJson(this.auditEmployeeSnapshot(employee)),
    });

    await this.writeEmployeeTimelineEvent({
      actor,
      employee,
      effectiveDate: employee.hireDate ?? employee.createdAt,
      title: 'Ingreso registrado',
      type: EmployeeTimelineEventType.HIRED,
      description: `${this.employeeFullName(employee)} ingreso a ${employee.company.name}.`,
    });

    return employee;
  }

  async previewEmployeeCode(tenantId: string, companyIdValue?: string) {
    const companyId = this.toOptionalString(companyIdValue);

    if (!companyId) {
      throw new BadRequestException('La empresa es obligatoria.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        employeeCodeSequence: {
          select: {
            lastNumber: true,
          },
        },
      },
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }

    const prefix = this.companyCodePrefix(company);
    const lastNumber =
      company.employeeCodeSequence?.lastNumber ??
      (await this.findCurrentMaxEmployeeCodeNumber(
        this.prisma,
        companyId,
        prefix,
      ));

    return {
      prefix,
      nextNumber: lastNumber + 1,
      code: this.formatEmployeeCode(prefix, lastNumber + 1),
    };
  }

  async getProfile(actor: AuthUser, employeeId: string) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(employeeId);

    if (!id) {
      throw new BadRequestException('El trabajador es obligatorio.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, ...employeeVisibilityScope(actor) },
      select: this.employeeWithTenantSelect(),
    });

    if (!employee || employee.tenantId !== tenantId) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    assertCompanyAccess(actor, employee.companyId);

    const [attendance, documents, requests, auditLogs, timelineEvents] =
      await Promise.all([
        this.prisma.attendanceRecord.findMany({
          where: { employeeId: employee.id, tenantId },
          orderBy: { workDate: 'desc' },
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
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
              },
            },
          },
        }),
        this.prisma.employeeDocument.findMany({
          where: { employeeId: employee.id, tenantId },
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
            folder: true,
            fileUrl: true,
            issuedAt: true,
            expiresAt: true,
            signedAt: true,
            signedByName: true,
            signedByEmail: true,
            signatureText: true,
            createdAt: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
              },
            },
          },
        }),
        this.prisma.employeeRequest.findMany({
          where: { employeeId: employee.id, tenantId },
          orderBy: { createdAt: 'desc' },
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
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
              },
            },
          },
        }),
        this.prisma.auditLog.findMany({
          where: {
            entityId: employee.id,
            entityType: 'Employee',
            tenantId,
          },
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
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
        this.prisma.employeeTimelineEvent.findMany({
          where: {
            employeeId: employee.id,
            tenantId,
          },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          take: 20,
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            effectiveDate: true,
            previousData: true,
            newData: true,
            createdBy: true,
            createdAt: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            area: {
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
              },
            },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
              },
            },
          },
        }),
      ]);

    const [attendanceSummary, relatedNotifications] = await Promise.all([
      this.buildEmployeeAttendanceSummary(tenantId, employee.id),
      this.findRelatedNotifications(tenantId, employee.id, {
        attendanceIds: attendance.map((record) => record.id),
        documentIds: documents.map((document) => document.id),
        requestIds: requests.map((request) => request.id),
      }),
    ]);

    return {
      employee,
      attendance,
      attendanceSummary,
      documents,
      requests,
      notifications: relatedNotifications,
      auditLogs,
      timelineEvents,
    };
  }

  async update(
    actor: AuthUser,
    employeeId: string,
    updateEmployeeDto: UpdateEmployeeDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(employeeId);
    const companyId = this.toOptionalString(updateEmployeeDto.companyId);
    const areaId = this.toOptionalString(updateEmployeeDto.areaId);
    const positionId = this.toOptionalString(updateEmployeeDto.positionId);
    const teamId = this.toOptionalString(updateEmployeeDto.teamId);
    const managerId = this.toOptionalString(updateEmployeeDto.managerId);
    const firstName = this.toOptionalString(updateEmployeeDto.firstName);
    const lastName = this.toOptionalString(updateEmployeeDto.lastName);
    const personalEmail =
      updateEmployeeDto.personalEmail !== undefined
        ? this.normalizeOptionalEmail(updateEmployeeDto.personalEmail)
        : undefined;
    const phoneMobile =
      updateEmployeeDto.phoneMobile !== undefined
        ? this.normalizeOptionalPhone(updateEmployeeDto.phoneMobile)
        : undefined;
    const address =
      updateEmployeeDto.address !== undefined
        ? this.normalizeOptionalLabel(updateEmployeeDto.address, 240)
        : undefined;
    const status = this.normalizeOptionalEmployeeStatus(
      updateEmployeeDto.status,
    );
    const terminationReason = this.normalizeOptionalLabel(
      updateEmployeeDto.terminationReason,
      500,
    );

    if (!id) {
      throw new BadRequestException('El trabajador es obligatorio.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: this.employeeWithTenantSelect(),
    });

    if (!employee || employee.tenantId !== tenantId) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    assertCompanyAccess(actor, employee.companyId);

    if (firstName) {
      this.assertPersonName(firstName, 'El nombre');
    }

    if (lastName) {
      this.assertPersonName(lastName, 'El apellido');
    }

    const targetCompanyId = companyId ?? employee.companyId;
    assertCompanyAccess(actor, targetCompanyId);

    if (companyId && companyId !== employee.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, tenantId: true },
      });

      if (!company || company.tenantId !== tenantId) {
        throw new BadRequestException('La empresa seleccionada no existe.');
      }
    }

    if (updateEmployeeDto.areaId !== undefined) {
      await this.assertOptionalArea(tenantId, targetCompanyId, areaId);
    }

    if (updateEmployeeDto.positionId !== undefined) {
      await this.assertOptionalPosition(tenantId, targetCompanyId, positionId);
    }

    if (updateEmployeeDto.teamId !== undefined) {
      await this.assertOptionalTeam(tenantId, targetCompanyId, teamId);
    }

    if (updateEmployeeDto.managerId !== undefined) {
      if (managerId === employee.id) {
        throw new BadRequestException(
          'Un trabajador no puede ser su propio jefe.',
        );
      }

      await this.assertOptionalManager(tenantId, targetCompanyId, managerId);
    }

    let employeeCode = this.normalizeOptionalCode(
      updateEmployeeDto.employeeCode,
      'El codigo de trabajador',
    );
    const documentNumber =
      updateEmployeeDto.documentNumber !== undefined
        ? this.normalizeOptionalDocumentNumber(updateEmployeeDto.documentNumber)
        : undefined;
    const nextStatus = status ?? employee.status;

    if (updateEmployeeDto.employeeCode !== undefined && !employeeCode) {
      employeeCode =
        employee.employeeCode ??
        (await this.generateEmployeeCode(targetCompanyId));
    }

    if (nextStatus === EmployeeStatus.TERMINATED) {
      const effectiveReason =
        updateEmployeeDto.terminationReason !== undefined
          ? terminationReason
          : employee.terminationReason;

      if (!effectiveReason) {
        throw new BadRequestException(
          'Indica la observacion del cese del trabajador.',
        );
      }
    }

    if (
      updateEmployeeDto.employeeCode !== undefined &&
      employeeCode &&
      (employeeCode !== employee.employeeCode ||
        targetCompanyId !== employee.companyId)
    ) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: {
          companyId_employeeCode: {
            companyId: targetCompanyId,
            employeeCode,
          },
        },
        select: { id: true },
      });

      if (existingEmployee && existingEmployee.id !== employee.id) {
        throw new ConflictException(
          'Ya existe un trabajador con ese codigo en la empresa.',
        );
      }
    }

    if (updateEmployeeDto.documentNumber !== undefined) {
      await this.assertUniqueDocumentNumber(
        tenantId,
        documentNumber ?? null,
        employee.id,
      );
    }

    if (updateEmployeeDto.personalEmail !== undefined) {
      await this.assertUniquePersonalEmail(
        tenantId,
        personalEmail ?? null,
        employee.id,
      );
    }

    const updatedEmployee = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(companyId ? { companyId } : {}),
        ...(updateEmployeeDto.areaId !== undefined ? { areaId } : {}),
        ...(updateEmployeeDto.positionId !== undefined ? { positionId } : {}),
        ...(updateEmployeeDto.teamId !== undefined ? { teamId } : {}),
        ...(updateEmployeeDto.managerId !== undefined ? { managerId } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(updateEmployeeDto.documentNumber !== undefined
          ? { documentNumber: documentNumber ?? null }
          : {}),
        ...(updateEmployeeDto.personalEmail !== undefined
          ? { personalEmail: personalEmail ?? null }
          : {}),
        ...(updateEmployeeDto.phoneMobile !== undefined
          ? { phoneMobile: phoneMobile ?? null }
          : {}),
        ...(updateEmployeeDto.address !== undefined
          ? { address: address ?? null }
          : {}),
        ...(updateEmployeeDto.employeeCode !== undefined
          ? { employeeCode }
          : {}),
        ...(updateEmployeeDto.jobTitle !== undefined
          ? {
              jobTitle: this.normalizeOptionalLabel(
                updateEmployeeDto.jobTitle,
                90,
              ),
            }
          : {}),
        ...(updateEmployeeDto.area !== undefined
          ? { area: this.normalizeOptionalLabel(updateEmployeeDto.area, 80) }
          : {}),
        ...(updateEmployeeDto.hireDate !== undefined
          ? { hireDate: this.normalizeOptionalDate(updateEmployeeDto.hireDate) }
          : {}),
        ...(status ? { status } : {}),
        ...(nextStatus === EmployeeStatus.TERMINATED &&
        updateEmployeeDto.terminatedAt === undefined &&
        !employee.terminatedAt
          ? { terminatedAt: new Date() }
          : {}),
        ...(updateEmployeeDto.terminatedAt !== undefined
          ? {
              terminatedAt: this.normalizeOptionalDate(
                updateEmployeeDto.terminatedAt,
              ),
            }
          : {}),
        ...(updateEmployeeDto.terminationReason !== undefined
          ? { terminationReason }
          : {}),
        ...(status && status !== EmployeeStatus.TERMINATED
          ? { terminatedAt: null, terminationReason: null }
          : {}),
      },
      select: this.employeeSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updatedEmployee.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'employee.updated',
      entityType: 'Employee',
      entityId: updatedEmployee.id,
      summary: `Se actualizo el trabajador ${updatedEmployee.firstName} ${updatedEmployee.lastName}.`,
      before: this.toJson(this.auditEmployeeSnapshot(employee)),
      after: this.toJson(this.auditEmployeeSnapshot(updatedEmployee)),
    });

    await this.recordEmployeeMovementEvents(actor, employee, updatedEmployee);

    return updatedEmployee;
  }

  async transfer(
    actor: AuthUser,
    employeeId: string,
    transferEmployeeDto: TransferEmployeeDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(employeeId);
    const companyId = this.toOptionalString(transferEmployeeDto.companyId);
    const areaId = this.toOptionalString(transferEmployeeDto.areaId);
    const positionId = this.toOptionalString(transferEmployeeDto.positionId);
    const teamId = this.toOptionalString(transferEmployeeDto.teamId);
    const managerId = this.toOptionalString(transferEmployeeDto.managerId);
    const clientId = this.toOptionalString(transferEmployeeDto.clientId);
    const effectiveDate =
      this.normalizeOptionalDate(transferEmployeeDto.effectiveDate) ??
      new Date();
    const reason = this.normalizeOptionalLabel(transferEmployeeDto.reason, 500);
    const role = this.normalizeOptionalLabel(transferEmployeeDto.role, 120);

    if (!id) {
      throw new BadRequestException('El trabajador es obligatorio.');
    }

    if (!companyId) {
      throw new BadRequestException('La empresa destino es obligatoria.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: this.employeeWithTenantSelect(),
    });

    if (!employee || employee.tenantId !== tenantId) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    assertCompanyAccess(actor, employee.companyId);
    assertCompanyAccess(actor, companyId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true },
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa destino no existe.');
    }

    if (managerId === employee.id) {
      throw new BadRequestException(
        'Un trabajador no puede ser su propio jefe.',
      );
    }

    await this.assertOptionalArea(tenantId, companyId, areaId);
    await this.assertOptionalPosition(tenantId, companyId, positionId);
    await this.assertOptionalTeam(tenantId, companyId, teamId);
    await this.assertOptionalManager(tenantId, companyId, managerId);
    await this.assertOptionalClient(tenantId, companyId, clientId);

    const employeeCode =
      companyId !== employee.companyId
        ? await this.generateEmployeeCode(companyId)
        : employee.employeeCode;

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          areaId,
          companyId,
          employeeCode,
          managerId,
          positionId,
          teamId,
          status:
            employee.status === EmployeeStatus.TERMINATED
              ? EmployeeStatus.ACTIVE
              : employee.status,
          ...(employee.status === EmployeeStatus.TERMINATED
            ? { terminatedAt: null, terminationReason: null }
            : {}),
        },
        select: { id: true },
      });

      if (clientId) {
        if (transferEmployeeDto.isPrimaryClientAssignment !== false) {
          await tx.employeeClientAssignment.updateMany({
            where: {
              employeeId: employee.id,
              isPrimary: true,
              status: 'ACTIVE',
            },
            data: { isPrimary: false },
          });
        }

        await tx.employeeClientAssignment.create({
          data: {
            tenantId,
            companyId,
            employeeId: employee.id,
            clientId,
            areaId,
            teamId,
            role,
            isPrimary: transferEmployeeDto.isPrimaryClientAssignment !== false,
            startsAt: effectiveDate,
          },
          select: { id: true },
        });
      }
    });

    const updatedEmployee = await this.prisma.employee.findFirst({
      where: { id: employee.id, tenantId },
      select: this.employeeSelect(),
    });

    if (!updatedEmployee) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    await this.auditService.write({
      tenantId,
      companyId: updatedEmployee.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'employee.transferred',
      entityType: 'Employee',
      entityId: updatedEmployee.id,
      summary: `Se transfirio el trabajador ${updatedEmployee.firstName} ${updatedEmployee.lastName}.`,
      before: this.toJson(this.auditEmployeeSnapshot(employee)),
      after: this.toJson({
        ...this.auditEmployeeSnapshot(updatedEmployee),
        effectiveDate: effectiveDate.toISOString().slice(0, 10),
        reason,
        clientId,
        clientRole: role,
      }),
    });

    await this.writeEmployeeTimelineEvent({
      actor,
      employee: updatedEmployee,
      previousEmployee: employee,
      effectiveDate,
      title: 'Transferencia laboral',
      type: EmployeeTimelineEventType.TRANSFERRED,
      description:
        reason ??
        this.describeChange(
          this.companyLabel(employee),
          this.companyLabel(updatedEmployee),
        ),
    });

    return updatedEmployee;
  }

  async updateAttendancePin(
    actor: AuthUser,
    employeeId: string,
    updateAttendancePinDto: UpdateAttendancePinDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(employeeId);
    const attendancePin = this.normalizeAttendancePin(
      updateAttendancePinDto.attendancePin,
    );

    if (!id) {
      throw new BadRequestException('El trabajador es obligatorio.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee || employee.tenantId !== tenantId) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    assertCompanyAccess(actor, employee.companyId);

    const updatedEmployee = await this.prisma.employee.update({
      where: { id },
      data: {
        attendancePinHash: await bcrypt.hash(attendancePin, 10),
        attendancePinChangeRequired: true,
        attendancePinFailedAttempts: 0,
        attendancePinLockedUntil: null,
      },
      select: this.employeeSelect(),
    });

    await this.auditService.write({
      tenantId: employee.tenantId,
      companyId: employee.companyId,
      actorType: 'system',
      actorLabel: 'Panel administrativo',
      action: 'employee.attendance_pin.updated',
      entityType: 'Employee',
      entityId: employee.id,
      summary: `Se cambio el PIN de marcacion de ${employee.firstName} ${employee.lastName}.`,
      before: {
        pin: 'Protegido',
      },
      after: {
        pin: 'Actualizado',
      },
    });

    return updatedEmployee;
  }

  async remove(actor: AuthUser, employeeId: string) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(employeeId);

    if (!id) {
      throw new BadRequestException('El trabajador es obligatorio.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        ...this.employeeWithTenantSelect(),
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        _count: {
          select: {
            attendanceRecords: true,
            documents: true,
            requests: true,
            directReports: true,
            leadingTeams: true,
          },
        },
      },
    });

    if (!employee || employee.tenantId !== tenantId) {
      throw new BadRequestException('El trabajador seleccionado no existe.');
    }

    assertCompanyAccess(actor, employee.companyId);

    if (employee.user?.id) {
      throw new BadRequestException(
        'Esta ficha tiene un usuario vinculado. Primero elimina el acceso desde Usuarios para conservar la ficha o evitar cuentas sin trabajador.',
      );
    }

    const hasHistory =
      employee._count.attendanceRecords > 0 ||
      employee._count.documents > 0 ||
      employee._count.requests > 0;

    if (hasHistory) {
      throw new BadRequestException(
        'No puedes eliminar una ficha con asistencia, documentos o solicitudes. Cambia su estado a inactivo para conservar el historial.',
      );
    }

    if (employee._count.directReports > 0 || employee._count.leadingTeams > 0) {
      throw new BadRequestException(
        'No puedes eliminar una ficha usada como jefe o responsable de equipo. Reasigna esas relaciones primero.',
      );
    }

    await this.prisma.employee.delete({
      where: { id: employee.id },
    });

    await this.auditService.write({
      tenantId,
      companyId: employee.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'employee.deleted',
      entityType: 'Employee',
      entityId: employee.id,
      summary: `Se elimino la ficha laboral de ${employee.firstName} ${employee.lastName}.`,
      before: this.toJson(this.auditEmployeeSnapshot(employee)),
    });

    return {
      deleted: true,
      id: employee.id,
    };
  }

  async selfUpdateAttendancePin(
    selfUpdateAttendancePinDto: SelfUpdateAttendancePinDto,
  ) {
    const identifier = this.toOptionalString(
      selfUpdateAttendancePinDto.identifier,
    );
    const currentPin = this.toOptionalString(
      selfUpdateAttendancePinDto.currentPin,
    );
    const newPin = this.normalizeAttendancePin(
      selfUpdateAttendancePinDto.newPin,
    );
    const companyScope = await this.resolvePublicCompanyScope(
      selfUpdateAttendancePinDto.tenantSlug,
      selfUpdateAttendancePinDto.companySlug,
    );

    if (!identifier || !currentPin) {
      throw new BadRequestException('Ingresa tu codigo o DNI y tu PIN actual.');
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
        attendancePinHash: true,
        attendancePinFailedAttempts: true,
        attendancePinLockedUntil: true,
      },
    });

    if (!employee) {
      await performDummyPinComparison(currentPin);
      throw new BadRequestException(
        'No pudimos validar tu empresa, codigo o PIN.',
      );
    }

    const replacementHash = await bcrypt.hash(newPin, 10);
    if (
      !(await verifyAttendancePinAtomically(
        this.prisma,
        employee.id,
        currentPin,
        replacementHash,
      ))
    ) {
      throw new BadRequestException(
        'No pudimos validar tu empresa, codigo o PIN.',
      );
    }

    await this.auditService.write({
      tenantId: employee.tenantId,
      companyId: employee.companyId,
      actorType: 'worker',
      actorLabel: `${employee.firstName} ${employee.lastName}`,
      action: 'employee.attendance_pin.self_updated',
      entityType: 'Employee',
      entityId: employee.id,
      summary: `${employee.firstName} ${employee.lastName} cambio su PIN de marcacion.`,
      before: {
        pin: 'Protegido',
      },
      after: {
        pin: 'Actualizado',
      },
    });

    return {
      status: 'ok',
      message: 'PIN actualizado correctamente.',
    };
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
      throw new BadRequestException('Selecciona la empresa para continuar.');
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

  private employeeSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      documentNumber: true,
      personalEmail: true,
      phoneMobile: true,
      address: true,
      employeeCode: true,
      areaId: true,
      positionId: true,
      teamId: true,
      managerId: true,
      jobTitle: true,
      area: true,
      hireDate: true,
      terminatedAt: true,
      terminationReason: true,
      status: true,
      createdAt: true,
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
          leader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
      },
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          avatarUrl: true,
        },
      },
    };
  }

  private employeeWithTenantSelect() {
    return {
      id: true,
      tenantId: true,
      companyId: true,
      firstName: true,
      lastName: true,
      documentNumber: true,
      personalEmail: true,
      phoneMobile: true,
      address: true,
      employeeCode: true,
      areaId: true,
      positionId: true,
      teamId: true,
      managerId: true,
      jobTitle: true,
      area: true,
      hireDate: true,
      terminatedAt: true,
      terminationReason: true,
      status: true,
      createdAt: true,
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
          leader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
      },
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          avatarUrl: true,
        },
      },
    };
  }

  private async buildEmployeeAttendanceSummary(
    tenantId: string,
    employeeId: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since = new Date(today);
    since.setDate(since.getDate() - 29);

    const records = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: {
        employeeId,
        tenantId,
        workDate: {
          gte: since,
          lte: today,
        },
      },
      _count: {
        id: true,
      },
    });

    const summary = {
      absent: 0,
      late: 0,
      onLeave: 0,
      present: 0,
      total: 0,
    };

    for (const record of records) {
      summary.total += record._count.id;

      if (record.status === 'PRESENT') {
        summary.present = record._count.id;
      }

      if (record.status === 'LATE') {
        summary.late = record._count.id;
      }

      if (record.status === 'ABSENT') {
        summary.absent = record._count.id;
      }

      if (record.status === 'ON_LEAVE') {
        summary.onLeave = record._count.id;
      }
    }

    return summary;
  }

  private findRelatedNotifications(
    tenantId: string,
    employeeId: string,
    relatedIds: {
      attendanceIds: string[];
      documentIds: string[];
      requestIds: string[];
    },
  ) {
    const entityFilters: Prisma.NotificationWhereInput[] = [
      {
        entityId: employeeId,
        entityType: 'Employee',
      },
    ];

    if (relatedIds.attendanceIds.length > 0) {
      entityFilters.push({
        entityId: { in: relatedIds.attendanceIds },
        entityType: 'AttendanceRecord',
      });
    }

    if (relatedIds.documentIds.length > 0) {
      entityFilters.push({
        entityId: { in: relatedIds.documentIds },
        entityType: 'EmployeeDocument',
      });
    }

    if (relatedIds.requestIds.length > 0) {
      entityFilters.push({
        entityId: { in: relatedIds.requestIds },
        entityType: 'EmployeeRequest',
      });
    }

    return this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: entityFilters,
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { generatedAt: 'desc' },
      ],
      take: 8,
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
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  private async writeEmployeeTimelineEvent({
    actor,
    description,
    effectiveDate,
    employee,
    previousEmployee,
    title,
    type,
  }: {
    actor: AuthUser;
    description?: string;
    effectiveDate?: Date | string | null;
    employee: TimelineEmployeeSource;
    previousEmployee?: TimelineEmployeeSource;
    title: string;
    type: EmployeeTimelineEventType;
  }) {
    await this.prisma.employeeTimelineEvent.create({
      data: {
        tenantId: employee.tenantId ?? actor.tenantId,
        employeeId: employee.id,
        companyId: employee.company.id,
        areaId: employee.areaRef?.id ?? null,
        positionId: employee.position?.id ?? null,
        teamId: employee.team?.id ?? null,
        managerId: employee.manager?.id ?? null,
        type,
        title,
        description,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        previousData: previousEmployee
          ? this.toJson(this.timelineEmployeeSnapshot(previousEmployee))
          : undefined,
        newData: this.toJson(this.timelineEmployeeSnapshot(employee)),
        createdBy: this.actorLabel(actor),
      },
    });
  }

  private async recordEmployeeMovementEvents(
    actor: AuthUser,
    before: TimelineEmployeeSource,
    after: TimelineEmployeeSource,
  ) {
    const events: Array<{
      description?: string;
      effectiveDate?: Date | string | null;
      title: string;
      type: EmployeeTimelineEventType;
    }> = [];

    if (
      before.status !== EmployeeStatus.TERMINATED &&
      after.status === EmployeeStatus.TERMINATED
    ) {
      events.push({
        type: EmployeeTimelineEventType.TERMINATED,
        title: 'Cese registrado',
        description: after.terminationReason
          ? `Observacion: ${after.terminationReason}`
          : 'El trabajador fue cesado.',
        effectiveDate: after.terminatedAt ?? new Date(),
      });
    }

    if (
      before.status === EmployeeStatus.TERMINATED &&
      after.status === EmployeeStatus.ACTIVE
    ) {
      events.push({
        type: EmployeeTimelineEventType.REHIRED,
        title: 'Reingreso registrado',
        description: `${this.employeeFullName(after)} volvio a estado activo.`,
        effectiveDate: after.hireDate ?? new Date(),
      });
    }

    if (before.company.id !== after.company.id) {
      events.push({
        type: EmployeeTimelineEventType.TRANSFERRED,
        title: 'Cambio de empresa',
        description: this.describeChange(
          this.companyLabel(before),
          this.companyLabel(after),
        ),
      });
    }

    if (
      this.normalizeComparable(before.areaRef?.id ?? before.area) !==
      this.normalizeComparable(after.areaRef?.id ?? after.area)
    ) {
      events.push({
        type: EmployeeTimelineEventType.TRANSFERRED,
        title: 'Cambio de area',
        description: this.describeChange(
          this.areaLabel(before),
          this.areaLabel(after),
        ),
      });
    }

    if (
      this.normalizeComparable(before.position?.id ?? before.jobTitle) !==
      this.normalizeComparable(after.position?.id ?? after.jobTitle)
    ) {
      events.push({
        type: EmployeeTimelineEventType.PROMOTED,
        title: 'Ascenso o cambio de cargo',
        description: this.describeChange(
          this.positionLabel(before),
          this.positionLabel(after),
        ),
      });
    }

    if (
      this.normalizeComparable(before.team?.id ?? null) !==
      this.normalizeComparable(after.team?.id ?? null)
    ) {
      events.push({
        type: EmployeeTimelineEventType.TEAM_CHANGED,
        title: 'Cambio de equipo',
        description: this.describeChange(
          this.teamLabel(before),
          this.teamLabel(after),
        ),
      });
    }

    if (
      this.normalizeComparable(before.manager?.id ?? null) !==
      this.normalizeComparable(after.manager?.id ?? null)
    ) {
      events.push({
        type: EmployeeTimelineEventType.MANAGER_CHANGED,
        title: 'Cambio de jefe directo',
        description: this.describeChange(
          this.managerLabel(before),
          this.managerLabel(after),
        ),
      });
    }

    for (const event of events) {
      await this.writeEmployeeTimelineEvent({
        actor,
        employee: after,
        previousEmployee: before,
        ...event,
      });
    }
  }

  private timelineEmployeeSnapshot(employee: TimelineEmployeeSource) {
    return {
      company: this.companyLabel(employee),
      area: this.areaLabel(employee),
      position: this.positionLabel(employee),
      team: this.teamLabel(employee),
      manager: this.managerLabel(employee),
      status: employee.status,
      hireDate: employee.hireDate
        ? new Date(employee.hireDate).toISOString().slice(0, 10)
        : null,
      terminatedAt: employee.terminatedAt
        ? new Date(employee.terminatedAt).toISOString().slice(0, 10)
        : null,
      terminationReason: employee.terminationReason ?? null,
    };
  }

  private employeeFullName(employee: { firstName: string; lastName: string }) {
    return `${employee.firstName} ${employee.lastName}`.trim();
  }

  private companyLabel(employee: TimelineEmployeeSource) {
    return employee.company.name;
  }

  private areaLabel(employee: TimelineEmployeeSource) {
    return employee.areaRef?.name ?? employee.area ?? 'Sin area';
  }

  private positionLabel(employee: TimelineEmployeeSource) {
    return employee.position?.name ?? employee.jobTitle ?? 'Sin cargo';
  }

  private teamLabel(employee: TimelineEmployeeSource) {
    return employee.team?.name ?? 'Sin equipo';
  }

  private managerLabel(employee: TimelineEmployeeSource) {
    return employee.manager
      ? this.employeeFullName(employee.manager)
      : 'Sin jefe';
  }

  private describeChange(previousValue: string, newValue: string) {
    return `${previousValue} -> ${newValue}`;
  }

  private normalizeComparable(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? '';
  }

  private actorLabel(actor: AuthUser) {
    return actor.email;
  }

  private async generateEmployeeCode(companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, slug: true },
      });

      if (!company) {
        throw new BadRequestException('La empresa seleccionada no existe.');
      }

      const prefix = this.companyCodePrefix(company);
      const existingSequence = await tx.employeeCodeSequence.findUnique({
        where: { companyId },
        select: { id: true, lastNumber: true },
      });

      if (existingSequence) {
        const nextSequence = await tx.employeeCodeSequence.update({
          where: { companyId },
          data: { lastNumber: { increment: 1 } },
          select: { lastNumber: true },
        });

        return this.formatEmployeeCode(prefix, nextSequence.lastNumber);
      }

      const lastNumber = await this.findCurrentMaxEmployeeCodeNumber(
        tx,
        companyId,
        prefix,
      );
      const nextNumber = lastNumber + 1;

      await tx.employeeCodeSequence.create({
        data: {
          companyId,
          lastNumber: nextNumber,
        },
        select: { id: true },
      });

      return this.formatEmployeeCode(prefix, nextNumber);
    });
  }

  private async findCurrentMaxEmployeeCodeNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    prefix: string,
  ) {
    const employees = await tx.employee.findMany({
      where: {
        companyId,
        employeeCode: {
          startsWith: `${prefix}-`,
          mode: 'insensitive',
        },
      },
      select: { employeeCode: true },
    });

    return employees.reduce((max, employee) => {
      const match = employee.employeeCode?.match(/^[A-Z]{2}-(\d{7})$/);
      const number = match ? Number(match[1]) : 0;

      return Number.isInteger(number) && number > max ? number : max;
    }, 0);
  }

  private companyCodePrefix(company: { name: string; slug: string }) {
    const key = company.slug.toLowerCase();
    const prefixes: Record<string, string> = {
      'grupo-sp': 'SP',
      mood: 'MD',
      supernova: 'SN',
      infinity: 'IN',
    };

    if (prefixes[key]) {
      return prefixes[key];
    }

    const normalizedName = company.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .trim()
      .toUpperCase();
    const words = normalizedName.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`;
    }

    return (words[0] ?? 'TR').slice(0, 2).padEnd(2, 'X');
  }

  private formatEmployeeCode(prefix: string, value: number) {
    return `${prefix}-${String(value).padStart(7, '0')}`;
  }

  private auditEmployeeSnapshot(employee: {
    id: string;
    firstName: string;
    lastName: string;
    documentNumber: string | null;
    personalEmail?: string | null;
    phoneMobile?: string | null;
    address?: string | null;
    employeeCode: string | null;
    areaId?: string | null;
    positionId?: string | null;
    teamId?: string | null;
    managerId?: string | null;
    jobTitle: string | null;
    area: string | null;
    hireDate: Date | string | null;
    terminatedAt?: Date | string | null;
    terminationReason?: string | null;
    status: EmployeeStatus;
    company: { id: string; name: string; slug: string };
  }) {
    return {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      documentNumber: employee.documentNumber,
      personalEmail: employee.personalEmail ?? null,
      phoneMobile: employee.phoneMobile ?? null,
      address: employee.address ?? null,
      employeeCode: employee.employeeCode,
      areaId: employee.areaId ?? null,
      positionId: employee.positionId ?? null,
      teamId: employee.teamId ?? null,
      managerId: employee.managerId ?? null,
      jobTitle: employee.jobTitle,
      area: employee.area,
      hireDate: employee.hireDate
        ? new Date(employee.hireDate).toISOString().slice(0, 10)
        : null,
      terminatedAt: employee.terminatedAt
        ? new Date(employee.terminatedAt).toISOString().slice(0, 10)
        : null,
      terminationReason: employee.terminationReason ?? null,
      status: employee.status,
      company: {
        id: employee.company.id,
        name: employee.company.name,
      },
    };
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private async assertOptionalArea(
    tenantId: string,
    companyId: string,
    areaId: string | null,
  ) {
    if (!areaId) {
      return;
    }

    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: { tenantId: true, companyId: true },
    });

    if (!area || area.tenantId !== tenantId || area.companyId !== companyId) {
      throw new BadRequestException(
        'El area seleccionada no pertenece a la empresa.',
      );
    }
  }

  private async assertOptionalPosition(
    tenantId: string,
    companyId: string,
    positionId: string | null,
  ) {
    if (!positionId) {
      return;
    }

    const position = await this.prisma.jobPosition.findUnique({
      where: { id: positionId },
      select: { tenantId: true, companyId: true, scope: true },
    });

    if (
      !position ||
      position.tenantId !== tenantId ||
      (position.scope !== 'GROUP' && position.companyId !== companyId)
    ) {
      throw new BadRequestException(
        'El cargo seleccionado no pertenece a la empresa.',
      );
    }
  }

  private async assertOptionalTeam(
    tenantId: string,
    companyId: string,
    teamId: string | null,
  ) {
    if (!teamId) {
      return;
    }

    const team = await this.prisma.workTeam.findUnique({
      where: { id: teamId },
      select: { tenantId: true, companyId: true },
    });

    if (!team || team.tenantId !== tenantId || team.companyId !== companyId) {
      throw new BadRequestException(
        'El equipo seleccionado no pertenece a la empresa.',
      );
    }
  }

  private async assertOptionalClient(
    tenantId: string,
    companyId: string,
    clientId: string | null,
  ) {
    if (!clientId) {
      return;
    }

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { tenantId: true, companyId: true, status: true },
    });

    if (
      !client ||
      client.tenantId !== tenantId ||
      client.companyId !== companyId ||
      client.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'El cliente seleccionado no pertenece a la empresa o no esta activo.',
      );
    }
  }

  private async assertOptionalManager(
    tenantId: string,
    companyId: string,
    managerId: string | null,
  ) {
    if (!managerId) {
      return;
    }

    const manager = await this.prisma.employee.findUnique({
      where: { id: managerId },
      select: { tenantId: true, companyId: true },
    });

    if (
      !manager ||
      manager.tenantId !== tenantId ||
      manager.companyId !== companyId
    ) {
      throw new BadRequestException(
        'El jefe seleccionado no pertenece a la empresa.',
      );
    }
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

  private normalizeAttendancePin(value: unknown) {
    const pin = this.toOptionalString(value);

    if (!pin) {
      throw new BadRequestException('El PIN de marcacion es obligatorio.');
    }

    if (!/^\d{6,8}$/.test(pin)) {
      throw new BadRequestException(
        'El PIN de marcacion debe tener entre 6 y 8 digitos.',
      );
    }

    if (
      /^(\d)\1+$/.test(pin) ||
      ['1234', '4321', '0123', '9876'].includes(pin)
    ) {
      throw new BadRequestException(
        'El PIN de marcacion es demasiado predecible.',
      );
    }

    return pin;
  }

  private assertPersonName(value: string, label: string) {
    if (value.length < 2 || value.length > 80) {
      throw new BadRequestException(
        `${label} debe tener entre 2 y 80 caracteres.`,
      );
    }

    if (!/^[\p{L}\p{M}' .-]+$/u.test(value)) {
      throw new BadRequestException(
        `${label} contiene caracteres no permitidos.`,
      );
    }
  }

  private normalizeOptionalDocumentNumber(value: unknown) {
    const normalized = this.toOptionalString(value)?.toUpperCase() ?? null;

    if (!normalized) {
      return null;
    }

    if (!/^[A-Za-z0-9-]{6,20}$/.test(normalized)) {
      throw new BadRequestException(
        'El documento debe tener entre 6 y 20 caracteres validos.',
      );
    }

    return normalized;
  }

  private normalizeOptionalEmail(value: unknown) {
    const normalized = this.toOptionalString(value)?.toLowerCase() ?? null;

    if (!normalized) {
      return null;
    }

    if (
      normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ) {
      throw new BadRequestException('El correo personal no es valido.');
    }

    return normalized;
  }

  private normalizeOptionalPhone(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    if (!/^\+?[0-9][0-9 ()-]{6,24}$/.test(normalized)) {
      throw new BadRequestException('El celular no es valido.');
    }

    return normalized;
  }

  private async assertUniqueDocumentNumber(
    tenantId: string,
    documentNumber: string | null,
    excludeEmployeeId?: string,
  ) {
    if (!documentNumber) {
      return;
    }

    const existingEmployee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        documentNumber,
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
      select: {
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    if (!existingEmployee) {
      return;
    }

    if (existingEmployee.status === EmployeeStatus.TERMINATED) {
      throw new ConflictException(
        `Ese DNI ya pertenece a ${existingEmployee.firstName} ${existingEmployee.lastName}. Si es un reingreso, reactiva o actualiza su ficha existente en vez de crear una nueva.`,
      );
    }

    throw new ConflictException(
      `Ese DNI ya pertenece a ${existingEmployee.firstName} ${existingEmployee.lastName}. No se puede crear otra ficha con el mismo DNI.`,
    );
  }

  private async assertUniquePersonalEmail(
    tenantId: string,
    personalEmail: string | null,
    excludeEmployeeId?: string,
  ) {
    if (!personalEmail) {
      return;
    }

    const existingEmployee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        personalEmail,
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    if (existingEmployee) {
      throw new ConflictException(
        `Ese correo ya pertenece a ${existingEmployee.firstName} ${existingEmployee.lastName}.`,
      );
    }
  }

  private normalizeOptionalCode(value: unknown, label: string) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    if (!/^[A-Za-z0-9-]{2,24}$/.test(normalized)) {
      throw new BadRequestException(
        `${label} debe tener entre 2 y 24 caracteres validos.`,
      );
    }

    return normalized.toUpperCase();
  }

  private normalizeOptionalLabel(value: unknown, maxLength: number) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength || /[<>]/.test(normalized)) {
      throw new BadRequestException('El texto enviado no es valido.');
    }

    return normalized;
  }

  private normalizeOptionalDate(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD.');
    }

    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('La fecha enviada no es valida.');
    }

    return date;
  }

  private normalizeOptionalEmployeeStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in EmployeeStatus)) {
      throw new BadRequestException('El estado de trabajador no es valido.');
    }

    return EmployeeStatus[normalized as keyof typeof EmployeeStatus];
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
}
