import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertCompanyAccess, hasPrivilegedRole } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { validPermissions } from '../auth/permission-matrix';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { CreateUserDto, UserAccessMode } from './dto/create-user.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const validPermissionSet = new Set<string>(validPermissions);

const systemRoleNames = new Set([
  'Super Admin',
  'Admin Grupo',
  'RRHH',
  'Gerencia',
  'Jefe de Area',
  'Trabajador',
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findUsers(
    tenantId: string,
    filters?: {
      companyId?: string;
      page?: string;
      pageSize?: string;
      roleId?: string;
      search?: string;
      status?: string;
    },
  ) {
    const where: Prisma.UserWhereInput = { tenantId };
    const companyId = this.toOptionalString(filters?.companyId);
    const page = this.normalizePage(filters?.page);
    const pageSize = this.normalizePageSize(filters?.pageSize);
    const search = this.toOptionalString(filters?.search);
    const roleId = this.toOptionalString(filters?.roleId);
    const status = this.normalizeOptionalUserStatus(filters?.status);

    if (companyId) {
      where.companyId = companyId;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { role: { name: { contains: search, mode: 'insensitive' } } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.userSelect(),
      }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    };
  }

  findRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        permissions: true,
        createdAt: true,
      },
    });
  }

  async createRole(actor: AuthUser, createRoleDto: CreateRoleDto) {
    this.assertPrivilegedAccess(actor, 'crear roles');
    const tenantId = actor.tenantId;
    const name = this.toOptionalString(createRoleDto.name);
    const description = this.toOptionalString(createRoleDto.description);
    const permissions = this.normalizePermissions(createRoleDto.permissions);

    if (!name) {
      throw new BadRequestException('El nombre del rol es obligatorio.');
    }

    const existingRole = await this.prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name,
        },
      },
      select: { id: true },
    });

    if (existingRole) {
      throw new ConflictException('Ya existe un rol con ese nombre.');
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name,
        description,
        permissions,
      },
      select: this.roleSelect(),
    });

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'role.created',
      entityType: 'role',
      entityId: role.id,
      summary: `Se creo el rol ${role.name}.`,
      after: this.toJson({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      }),
    });

    return role;
  }

  async updateRole(
    actor: AuthUser,
    roleId: string,
    updateRoleDto: UpdateRoleDto,
  ) {
    this.assertPrivilegedAccess(actor, 'editar roles');
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(roleId);
    const name = this.toOptionalString(updateRoleDto.name);
    const description = this.toOptionalString(updateRoleDto.description);
    const permissions = this.normalizePermissions(updateRoleDto.permissions);

    if (!id) {
      throw new BadRequestException('El rol es obligatorio.');
    }

    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        permissions: true,
      },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new BadRequestException('El rol seleccionado no existe.');
    }

    if (name && name !== role.name && systemRoleNames.has(role.name)) {
      throw new BadRequestException(
        'Los roles base del sistema no se pueden renombrar.',
      );
    }

    if (name && name !== role.name) {
      const existingRole = await this.prisma.role.findUnique({
        where: {
          tenantId_name: {
            tenantId,
            name,
          },
        },
        select: { id: true },
      });

      if (existingRole) {
        throw new ConflictException('Ya existe un rol con ese nombre.');
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(updateRoleDto.description !== undefined ? { description } : {}),
        ...(updateRoleDto.permissions !== undefined ? { permissions } : {}),
      },
      select: this.roleSelect(),
    });

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'role.updated',
      entityType: 'role',
      entityId: updatedRole.id,
      summary: `Se actualizo el rol ${updatedRole.name}.`,
      before: this.toJson({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      }),
      after: this.toJson({
        name: updatedRole.name,
        description: updatedRole.description,
        permissions: updatedRole.permissions,
      }),
    });

    return updatedRole;
  }

  async deleteRole(actor: AuthUser, roleId: string) {
    this.assertPrivilegedAccess(actor);

    const tenantId = actor.tenantId;
    const id = this.toOptionalString(roleId);

    if (!id) {
      throw new BadRequestException('El rol es obligatorio.');
    }

    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        permissions: true,
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new BadRequestException('El rol seleccionado no existe.');
    }

    if (systemRoleNames.has(role.name)) {
      throw new BadRequestException(
        'Este rol es base del sistema y no se puede eliminar.',
      );
    }

    if (role._count.users > 0) {
      throw new BadRequestException(
        'No puedes eliminar un rol que todavia tiene usuarios asignados.',
      );
    }

    await this.prisma.role.delete({ where: { id: role.id } });

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'role.deleted',
      entityType: 'role',
      entityId: role.id,
      summary: `Se elimino el rol ${role.name}.`,
      before: this.toJson({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      }),
    });

    return {
      deleted: true,
      id: role.id,
    };
  }

  async createUser(actor: AuthUser, createUserDto: CreateUserDto) {
    const tenantId = actor.tenantId;
    const email = this.toOptionalString(createUserDto.email)?.toLowerCase();
    const firstName = this.toOptionalString(createUserDto.firstName);
    const lastName = this.toOptionalString(createUserDto.lastName);
    const password = this.toOptionalString(createUserDto.password);
    const roleId = this.toOptionalString(createUserDto.roleId);
    const companyId = this.toOptionalString(createUserDto.companyId);
    const employeeId = this.toOptionalString(createUserDto.employeeId);
    const employeeCompanyId =
      this.toOptionalString(createUserDto.employeeCompanyId) ?? companyId;
    const avatarUrl = this.toOptionalUploadPath(createUserDto.avatarUrl);
    const status =
      this.normalizeOptionalUserStatus(createUserDto.status) ??
      UserStatus.ACTIVE;
    const documentNumber = this.normalizeOptionalDocumentNumber(
      createUserDto.documentNumber,
    );
    let employeeCode = this.normalizeOptionalCode(
      createUserDto.employeeCode,
      'El codigo de trabajador',
    );
    const attendancePin =
      createUserDto.attendancePin === undefined
        ? null
        : this.normalizeAttendancePin(createUserDto.attendancePin);
    const areaId = this.toOptionalString(createUserDto.areaId);
    const positionId = this.toOptionalString(createUserDto.positionId);
    const teamId = this.toOptionalString(createUserDto.teamId);
    const managerId = this.toOptionalString(createUserDto.managerId);
    const jobTitle = this.normalizeOptionalLabel(createUserDto.jobTitle, 90);
    const area = this.normalizeOptionalLabel(createUserDto.area, 80);
    const hireDate = this.normalizeOptionalDate(createUserDto.hireDate);

    if (!email || !firstName || !lastName || !password || !roleId) {
      throw new BadRequestException(
        'Nombre, apellido, correo, rol y contraseña son obligatorios.',
      );
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres.',
      );
    }

    this.assertEmail(email);
    this.assertPersonName(firstName, 'El nombre');
    this.assertPersonName(lastName, 'El apellido');

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        permissions: true,
      },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new BadRequestException('El rol seleccionado no existe.');
    }

    if (hasPrivilegedRole({ ...actor, roleName: role.name })) {
      this.assertPrivilegedAccess(actor, 'asignar roles globales');

      if (companyId) {
        throw new BadRequestException(
          'Los roles globales no pueden quedar limitados a una empresa.',
        );
      }
    }

    const accessMode = this.normalizeAccessMode(
      createUserDto.accessMode,
      role.permissions,
    );
    const shouldCreateWorkerProfile = accessMode !== 'admin';

    const linkedEmployee =
      shouldCreateWorkerProfile && employeeId
        ? await this.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
              id: true,
              tenantId: true,
              companyId: true,
              userId: true,
              firstName: true,
              lastName: true,
              documentNumber: true,
              employeeCode: true,
              jobTitle: true,
              area: true,
              hireDate: true,
            },
          })
        : null;

    if (
      employeeId &&
      (!linkedEmployee || linkedEmployee.tenantId !== tenantId)
    ) {
      throw new BadRequestException('La ficha laboral seleccionada no existe.');
    }

    if (linkedEmployee?.userId) {
      throw new ConflictException(
        'Esta ficha laboral ya tiene acceso al sistema.',
      );
    }

    if (shouldCreateWorkerProfile && !linkedEmployee && !employeeCompanyId) {
      throw new BadRequestException(
        'El portal trabajador requiere seleccionar la empresa laboral.',
      );
    }

    if (shouldCreateWorkerProfile && !linkedEmployee && !attendancePin) {
      throw new BadRequestException(
        'El PIN inicial es obligatorio para crear el acceso trabajador.',
      );
    }

    await this.assertOptionalCompany(tenantId, companyId);
    await this.assertOptionalCompany(tenantId, employeeCompanyId);

    assertCompanyAccess(actor, companyId);
    if (shouldCreateWorkerProfile) {
      assertCompanyAccess(
        actor,
        linkedEmployee?.companyId ?? employeeCompanyId,
      );
    }

    if (
      shouldCreateWorkerProfile &&
      !linkedEmployee &&
      !positionId &&
      !jobTitle
    ) {
      throw new BadRequestException(
        'El portal trabajador requiere indicar el cargo laboral.',
      );
    }

    if (shouldCreateWorkerProfile && !linkedEmployee && employeeCompanyId) {
      await this.assertOptionalArea(tenantId, employeeCompanyId, areaId);
      await this.assertOptionalPosition(
        tenantId,
        employeeCompanyId,
        positionId,
      );
      await this.assertOptionalTeam(tenantId, employeeCompanyId, teamId);
      await this.assertOptionalManager(tenantId, employeeCompanyId, managerId);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    if (
      shouldCreateWorkerProfile &&
      createUserDto.documentNumber !== undefined
    ) {
      await this.assertUniqueEmployeeDocumentNumber(
        tenantId,
        documentNumber,
        linkedEmployee?.id,
      );
    }

    if (
      shouldCreateWorkerProfile &&
      !linkedEmployee &&
      !employeeCode &&
      employeeCompanyId
    ) {
      employeeCode = await this.generateEmployeeCode(employeeCompanyId);
    }

    if (
      shouldCreateWorkerProfile &&
      linkedEmployee &&
      !linkedEmployee.employeeCode &&
      !employeeCode
    ) {
      employeeCode = await this.generateEmployeeCode(linkedEmployee.companyId);
    }

    if (
      shouldCreateWorkerProfile &&
      !linkedEmployee &&
      employeeCode &&
      employeeCompanyId
    ) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: {
          companyId_employeeCode: {
            companyId: employeeCompanyId,
            employeeCode,
          },
        },
        select: { id: true },
      });

      if (existingEmployee) {
        throw new ConflictException(
          'Ya existe un trabajador con ese codigo en la empresa laboral.',
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdUserOrResponse = !shouldCreateWorkerProfile
      ? await this.createAdminUserResponse({
          avatarUrl,
          companyId,
          email,
          firstName,
          lastName,
          passwordHash,
          role: {
            id: role.id,
            name: role.name,
            description: role.description,
          },
          roleId,
          status,
          tenantId,
        })
      : await this.prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              tenantId,
              companyId,
              roleId,
              email,
              passwordHash,
              firstName,
              lastName,
              avatarUrl,
              status,
            },
            select: { id: true },
          });

          if (linkedEmployee) {
            await tx.employee.update({
              where: { id: linkedEmployee.id },
              data: {
                userId: createdUser.id,
                firstName,
                lastName,
                ...(createUserDto.documentNumber !== undefined && documentNumber
                  ? { documentNumber }
                  : {}),
                ...(employeeCode && employeeCode !== linkedEmployee.employeeCode
                  ? { employeeCode }
                  : {}),
                ...(createUserDto.attendancePin !== undefined
                  ? {
                      attendancePinHash: await bcrypt.hash(attendancePin!, 10),
                      attendancePinChangeRequired: true,
                    }
                  : {}),
                ...(createUserDto.areaId !== undefined ? { areaId } : {}),
                ...(createUserDto.positionId !== undefined
                  ? { positionId }
                  : {}),
                ...(createUserDto.teamId !== undefined ? { teamId } : {}),
                ...(createUserDto.managerId !== undefined ? { managerId } : {}),
                ...(createUserDto.jobTitle !== undefined && jobTitle
                  ? { jobTitle }
                  : {}),
                ...(createUserDto.area !== undefined && area ? { area } : {}),
                ...(createUserDto.hireDate !== undefined && hireDate
                  ? { hireDate }
                  : {}),
              },
            });
          } else if (shouldCreateWorkerProfile) {
            await tx.employee.create({
              data: {
                tenantId,
                companyId: employeeCompanyId!,
                userId: createdUser.id,
                firstName,
                lastName,
                documentNumber,
                employeeCode,
                attendancePinHash: await bcrypt.hash(attendancePin!, 10),
                attendancePinChangeRequired: true,
                areaId,
                positionId,
                teamId,
                managerId,
                jobTitle,
                area,
                hireDate,
              },
            });
          }

          return createdUser.id;
        });

    const user =
      typeof createdUserOrResponse === 'string'
        ? await this.prisma.user.findUnique({
            where: { id: createdUserOrResponse },
            select: this.userSelect(),
          })
        : createdUserOrResponse;

    if (!user) {
      throw new BadRequestException('No se pudo crear el usuario.');
    }

    await this.auditService.write({
      tenantId,
      companyId: user.company?.id ?? null,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      summary: `Se creo el usuario ${user.firstName} ${user.lastName} con rol ${role.name}.`,
      after: this.toJson(this.auditUserSnapshot(user)),
    });

    return user;
  }

  async updateUser(
    actor: AuthUser,
    userId: string,
    updateUserDto: UpdateUserDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.toOptionalString(userId);
    const firstName = this.toOptionalString(updateUserDto.firstName);
    const lastName = this.toOptionalString(updateUserDto.lastName);
    const roleId = this.toOptionalString(updateUserDto.roleId);
    const companyId = this.toOptionalString(updateUserDto.companyId);
    const employeeId = this.toOptionalString(updateUserDto.employeeId);
    const employeeCompanyId = this.toOptionalString(
      updateUserDto.employeeCompanyId,
    );
    const avatarUrl = this.toOptionalUploadPath(updateUserDto.avatarUrl);
    const password = this.toOptionalString(updateUserDto.password);
    const status = this.normalizeOptionalUserStatus(updateUserDto.status);
    const documentNumber = this.normalizeOptionalDocumentNumber(
      updateUserDto.documentNumber,
    );
    let employeeCode = this.normalizeOptionalCode(
      updateUserDto.employeeCode,
      'El codigo de trabajador',
    );
    const requestedAttendancePin = this.toOptionalString(
      updateUserDto.attendancePin,
    );
    const attendancePin = requestedAttendancePin
      ? this.normalizeAttendancePin(requestedAttendancePin)
      : null;
    const areaId = this.toOptionalString(updateUserDto.areaId);
    const positionId = this.toOptionalString(updateUserDto.positionId);
    const teamId = this.toOptionalString(updateUserDto.teamId);
    const managerId = this.toOptionalString(updateUserDto.managerId);
    const jobTitle = this.normalizeOptionalLabel(updateUserDto.jobTitle, 90);
    const area = this.normalizeOptionalLabel(updateUserDto.area, 80);
    const hireDate = this.normalizeOptionalDate(updateUserDto.hireDate);

    if (!id) {
      throw new BadRequestException('El usuario es obligatorio.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        tenantId: true,
        status: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        employee: {
          select: {
            id: true,
            companyId: true,
            documentNumber: true,
            employeeCode: true,
            areaId: true,
            positionId: true,
            teamId: true,
            managerId: true,
          },
        },
      },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new BadRequestException('El usuario seleccionado no existe.');
    }

    assertCompanyAccess(actor, user.companyId);
    if (user.employee) {
      assertCompanyAccess(actor, user.employee.companyId);
    }

    if (firstName) {
      this.assertPersonName(firstName, 'El nombre');
    }

    if (lastName) {
      this.assertPersonName(lastName, 'El apellido');
    }

    if (password && password.length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres.',
      );
    }

    if (user.id === actor.sub && status && status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        'No puedes deshabilitar tu propio usuario.',
      );
    }

    if (roleId && roleId !== user.roleId) {
      this.assertPrivilegedAccess(actor);
    }

    if (
      user.id === actor.sub &&
      updateUserDto.companyId !== undefined &&
      companyId &&
      companyId !== user.companyId
    ) {
      throw new BadRequestException(
        'No puedes limitar tu propio acceso a una sola empresa.',
      );
    }

    let targetRoleName = user.role?.name ?? null;

    if (roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: roleId },
        select: { id: true, name: true, tenantId: true },
      });

      if (!role || role.tenantId !== tenantId) {
        throw new BadRequestException('El rol seleccionado no existe.');
      }

      targetRoleName = role.name;
    }

    const targetCompanyId =
      updateUserDto.companyId === undefined ? user.companyId : companyId;

    if (hasPrivilegedRole({ ...actor, roleName: targetRoleName })) {
      this.assertPrivilegedAccess(actor, 'asignar roles globales');

      if (targetCompanyId) {
        throw new BadRequestException(
          'Los roles globales no pueden quedar limitados a una empresa.',
        );
      }
    }

    await this.assertOptionalCompany(tenantId, companyId);
    await this.assertOptionalCompany(tenantId, employeeCompanyId);

    if (updateUserDto.companyId !== undefined) {
      assertCompanyAccess(actor, companyId);
    }

    const targetEmployeeCompanyId =
      employeeCompanyId ?? user.employee?.companyId ?? null;

    const employeeToLink =
      employeeId && !user.employee
        ? await this.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
              id: true,
              tenantId: true,
              companyId: true,
              userId: true,
            },
          })
        : null;

    if (employeeId && user.employee) {
      throw new BadRequestException('Este usuario ya tiene una ficha laboral.');
    }

    if (
      employeeId &&
      (!employeeToLink || employeeToLink.tenantId !== tenantId)
    ) {
      throw new BadRequestException('La ficha laboral seleccionada no existe.');
    }

    if (employeeToLink?.userId) {
      throw new ConflictException(
        'Esta ficha laboral ya tiene acceso al sistema.',
      );
    }

    if (employeeToLink) {
      assertCompanyAccess(actor, employeeToLink.companyId);
    }

    if (user.employee && !targetEmployeeCompanyId) {
      throw new BadRequestException(
        'La ficha laboral requiere seleccionar una empresa laboral.',
      );
    }

    if (user.employee) {
      assertCompanyAccess(actor, targetEmployeeCompanyId);
    }

    if (user.employee && updateUserDto.areaId !== undefined) {
      await this.assertOptionalArea(tenantId, targetEmployeeCompanyId!, areaId);
    }

    if (user.employee && updateUserDto.positionId !== undefined) {
      await this.assertOptionalPosition(
        tenantId,
        targetEmployeeCompanyId!,
        positionId,
      );
    }

    if (user.employee && updateUserDto.teamId !== undefined) {
      await this.assertOptionalTeam(tenantId, targetEmployeeCompanyId!, teamId);
    }

    if (user.employee && updateUserDto.managerId !== undefined) {
      if (managerId === user.employee.id) {
        throw new BadRequestException(
          'El trabajador no puede ser su propio jefe.',
        );
      }

      await this.assertOptionalManager(
        tenantId,
        targetEmployeeCompanyId!,
        managerId,
      );
    }

    if (
      user.employee &&
      !user.employee.employeeCode &&
      !employeeCode &&
      targetEmployeeCompanyId
    ) {
      employeeCode = await this.generateEmployeeCode(targetEmployeeCompanyId);
    }

    if (
      user.employee &&
      employeeCode &&
      targetEmployeeCompanyId &&
      (employeeCode !== user.employee.employeeCode ||
        targetEmployeeCompanyId !== user.employee.companyId)
    ) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: {
          companyId_employeeCode: {
            companyId: targetEmployeeCompanyId,
            employeeCode,
          },
        },
        select: { id: true },
      });

      if (existingEmployee && existingEmployee.id !== user.employee.id) {
        throw new ConflictException(
          'Ya existe un trabajador con ese codigo en la empresa laboral.',
        );
      }
    }

    if (user.employee && updateUserDto.documentNumber !== undefined) {
      await this.assertUniqueEmployeeDocumentNumber(
        tenantId,
        documentNumber,
        user.employee.id,
      );
    }

    const updatedUserId = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id },
        data: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(updateUserDto.avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(roleId ? { roleId } : {}),
          ...(updateUserDto.companyId !== undefined ? { companyId } : {}),
          ...(password
            ? { passwordHash: await bcrypt.hash(password, 10) }
            : {}),
          ...(status ? { status } : {}),
        },
        select: { id: true },
      });

      if (employeeToLink) {
        await tx.employee.update({
          where: { id: employeeToLink.id },
          data: {
            userId: nextUser.id,
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
          },
        });
      } else if (user.employee) {
        await tx.employee.update({
          where: { id: user.employee.id },
          data: {
            ...(employeeCompanyId !== null
              ? { companyId: employeeCompanyId }
              : {}),
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(updateUserDto.documentNumber !== undefined
              ? { documentNumber }
              : {}),
            ...(employeeCode && employeeCode !== user.employee.employeeCode
              ? { employeeCode }
              : {}),
            ...(attendancePin
              ? {
                  attendancePinHash: await bcrypt.hash(attendancePin, 10),
                  attendancePinChangeRequired: true,
                }
              : {}),
            ...(updateUserDto.areaId !== undefined ? { areaId } : {}),
            ...(updateUserDto.positionId !== undefined ? { positionId } : {}),
            ...(updateUserDto.teamId !== undefined ? { teamId } : {}),
            ...(updateUserDto.managerId !== undefined ? { managerId } : {}),
            ...(updateUserDto.jobTitle !== undefined ? { jobTitle } : {}),
            ...(updateUserDto.area !== undefined ? { area } : {}),
            ...(updateUserDto.hireDate !== undefined ? { hireDate } : {}),
          },
        });
      }

      return nextUser.id;
    });

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: updatedUserId },
      select: this.userSelect(),
    });

    if (!updatedUser) {
      throw new BadRequestException('No se pudo actualizar el usuario.');
    }

    await this.auditService.write({
      tenantId,
      companyId: updatedUser.company?.id ?? user.companyId ?? null,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'user.updated',
      entityType: 'user',
      entityId: updatedUser.id,
      summary: `Se actualizo el usuario ${updatedUser.firstName} ${updatedUser.lastName}.`,
      before: this.toJson(this.auditUserSnapshot(user)),
      after: this.toJson(this.auditUserSnapshot(updatedUser)),
    });

    return updatedUser;
  }

  async deleteUser(actor: AuthUser, userId: string) {
    this.assertPrivilegedAccess(actor);

    const tenantId = actor.tenantId;
    const id = this.toOptionalString(userId);

    if (!id) {
      throw new BadRequestException('El usuario es obligatorio.');
    }

    if (id === actor.sub) {
      throw new BadRequestException('No puedes eliminar tu propio usuario.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        roleId: true,
        tenantId: true,
        status: true,
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
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new BadRequestException('El usuario seleccionado no existe.');
    }

    if (user.role?.name === 'Super Admin' && actor.roleName !== 'Super Admin') {
      throw new ForbiddenException(
        'Solo un Super Admin puede eliminar otro Super Admin.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (user.employee?.id) {
        await tx.employee.update({
          where: { id: user.employee.id },
          data: { userId: null },
        });
      }

      await tx.user.delete({
        where: { id: user.id },
      });
    });

    await this.auditService.write({
      tenantId,
      companyId: user.company?.id ?? user.companyId ?? null,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'user.deleted',
      entityType: 'user',
      entityId: user.id,
      summary: `Se elimino el acceso de ${user.firstName} ${user.lastName}.`,
      before: this.toJson(this.auditUserSnapshot(user)),
    });

    return {
      deleted: true,
      id: user.id,
    };
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      status: true,
      createdAt: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      employee: {
        select: {
          id: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          documentNumber: true,
          employeeCode: true,
          areaId: true,
          positionId: true,
          teamId: true,
          managerId: true,
          jobTitle: true,
          area: true,
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
          hireDate: true,
        },
      },
    };
  }

  private async createAdminUserResponse(input: {
    avatarUrl: string | null;
    companyId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    role: { id: string; name: string; description: string | null };
    roleId: string;
    status: UserStatus;
    tenantId: string;
  }) {
    const createdUser = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        roleId: input.roleId,
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        avatarUrl: input.avatarUrl,
        status: input.status,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });
    const company = input.companyId
      ? await this.prisma.company.findUnique({
          where: { id: input.companyId },
          select: { id: true, name: true, slug: true },
        })
      : null;

    return {
      ...createdUser,
      company,
      role: input.role,
      employee: null,
    };
  }

  private roleSelect() {
    return {
      id: true,
      name: true,
      description: true,
      permissions: true,
      createdAt: true,
    };
  }

  private actorLabel(actor: AuthUser) {
    return actor.email;
  }

  private assertPrivilegedAccess(
    actor: AuthUser,
    action = 'realizar esta accion',
  ) {
    if (hasPrivilegedRole(actor) && !actor.companyId) {
      return;
    }

    throw new ForbiddenException(
      `Solo Admin Grupo o Super Admin global pueden ${action}.`,
    );
  }

  private auditUserSnapshot(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    status: UserStatus;
    company?: { id: string; name: string; slug: string } | null;
    role?: { id: string; name: string; description: string | null } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      status: user.status,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
          }
        : null,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
          }
        : null,
    };
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private normalizeOptionalUserStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in UserStatus)) {
      throw new BadRequestException('El estado de usuario no es valido.');
    }

    return UserStatus[normalized as keyof typeof UserStatus];
  }

  private normalizePermissions(value: unknown) {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException(
        'Los permisos deben enviarse como una lista.',
      );
    }

    const permissions = [
      ...new Set(value.map((permission) => String(permission).trim())),
    ].filter(Boolean);
    const invalidPermission = permissions.find(
      (permission) => !validPermissionSet.has(permission),
    );

    if (invalidPermission) {
      throw new BadRequestException(
        `El permiso ${invalidPermission} no existe.`,
      );
    }

    return permissions;
  }

  private shouldCreateWorkerProfile(permissions: string[]) {
    return (
      permissions.includes('attendance.mark') &&
      !this.hasAdministrativeAccess(permissions)
    );
  }

  private normalizeAccessMode(
    value: unknown,
    rolePermissions: string[],
  ): UserAccessMode {
    const normalized = this.toOptionalString(value);
    const hasAdminAccess = this.hasAdministrativeAccess(rolePermissions);
    const hasPortalPermission = rolePermissions.includes('attendance.mark');

    if (!normalized) {
      return this.shouldCreateWorkerProfile(rolePermissions)
        ? 'portal'
        : 'admin';
    }

    if (!['admin', 'portal', 'both'].includes(normalized)) {
      throw new BadRequestException('El tipo de acceso no es valido.');
    }

    const accessMode = normalized as UserAccessMode;

    if (accessMode === 'admin' && !hasAdminAccess) {
      throw new BadRequestException(
        'Para acceso solo al panel administrativo selecciona un rol administrativo.',
      );
    }

    if (accessMode === 'portal' && hasAdminAccess) {
      throw new BadRequestException(
        'Para acceso solo al portal trabajador selecciona un rol trabajador sin permisos administrativos.',
      );
    }

    if (accessMode === 'portal' && !hasPortalPermission) {
      throw new BadRequestException(
        'El rol trabajador debe tener permiso de marcacion o portal.',
      );
    }

    if (accessMode === 'both' && !hasAdminAccess) {
      throw new BadRequestException(
        'Para dar acceso a ambos paneles selecciona un rol administrativo.',
      );
    }

    return accessMode;
  }

  private hasAdministrativeAccess(permissions: string[]) {
    const adminPermissions = [
      'companies.manage',
      'employees.view',
      'employees.manage',
      'attendance.view',
      'attendance.manage',
      'requests.view',
      'requests.approve',
      'documents.manage',
      'notifications.manage',
      'automations.view',
      'automations.manage',
      'organization.view',
      'organization.manage',
      'benefits.manage',
      'users.manage',
      'audit.view',
    ];

    return adminPermissions.some((permission) =>
      permissions.includes(permission),
    );
  }

  private async assertOptionalCompany(
    tenantId: string,
    companyId: string | null,
  ) {
    if (!companyId) {
      return;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true },
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }
  }

  private normalizeAttendancePin(value: unknown) {
    const pin = this.toOptionalString(value);

    if (!pin) {
      throw new BadRequestException('El PIN de marcacion es obligatorio.');
    }

    if (!/^\d{4,8}$/.test(pin)) {
      throw new BadRequestException(
        'El PIN de marcacion debe tener entre 4 y 8 digitos.',
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

  private normalizeOptionalDocumentNumber(value: unknown) {
    const normalized = this.toOptionalString(value);

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

  private async assertUniqueEmployeeDocumentNumber(
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

    if (existingEmployee.status === 'TERMINATED') {
      throw new ConflictException(
        `Ese DNI ya pertenece a ${existingEmployee.firstName} ${existingEmployee.lastName}. Si es un reingreso, reactiva o actualiza su ficha existente en vez de crear una nueva.`,
      );
    }

    throw new ConflictException(
      `Ese DNI ya pertenece a ${existingEmployee.firstName} ${existingEmployee.lastName}. No se puede crear otra ficha con el mismo DNI.`,
    );
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

    const date = new Date(`${normalized}T00:00:00.000`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha enviada no es valida.');
    }

    return date;
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

  private assertEmail(value: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
      throw new BadRequestException('El correo no tiene un formato valido.');
    }
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
