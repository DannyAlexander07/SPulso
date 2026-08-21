import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { JobPositionScope, OrganizationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type {
  CreateAreaDto,
  CreateClientDto,
  CreateEmployeeClientAssignmentDto,
  CreateJobPositionDto,
  CreateWorkTeamDto,
  UpdateAreaDto,
  UpdateClientDto,
  UpdateEmployeeClientAssignmentDto,
  UpdateJobPositionDto,
  UpdateWorkTeamMembersDto,
  UpdateWorkTeamDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string, filters?: { companyId?: string }) {
    const companyId = this.toOptionalUuid(
      filters?.companyId,
      'La empresa no es valida.',
    );
    const where = companyId ? { tenantId, companyId } : { tenantId };
    const positionWhere = companyId
      ? {
          tenantId,
          OR: [{ companyId }, { scope: JobPositionScope.GROUP }],
        }
      : { tenantId };

    const [areas, positions, teams, clients, assignments, employees] =
      await Promise.all([
        this.prisma.area.findMany({
          where,
          orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
          select: this.areaSelect(),
        }),
        this.prisma.jobPosition.findMany({
          where: positionWhere,
          orderBy: [
            { scope: 'desc' },
            { company: { name: 'asc' } },
            { name: 'asc' },
          ],
          select: this.positionSelect(),
        }),
        this.prisma.workTeam.findMany({
          where,
          orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
          select: this.teamSelect(),
        }),
        this.prisma.client.findMany({
          where,
          orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
          select: this.clientSelect(),
        }),
        this.prisma.employeeClientAssignment.findMany({
          where,
          orderBy: [{ client: { name: 'asc' } }, { createdAt: 'desc' }],
          select: this.assignmentSelect(),
        }),
        this.prisma.employee.findMany({
          where: { tenantId, ...(companyId ? { companyId } : {}) },
          orderBy: [{ company: { name: 'asc' } }, { firstName: 'asc' }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            area: true,
            teamId: true,
            status: true,
            company: { select: { id: true, name: true, slug: true } },
            areaRef: { select: { id: true, name: true, slug: true } },
            position: { select: { id: true, name: true, slug: true } },
            team: { select: { id: true, name: true, slug: true } },
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

    return {
      areas,
      positions,
      teams,
      clients,
      assignments,
      employees,
      summary: {
        areas: areas.length,
        clients: clients.length,
        assignments: assignments.length,
        positions: positions.length,
        teams: teams.length,
        employees: employees.length,
      },
    };
  }

  async createArea(actor: AuthUser, createAreaDto: CreateAreaDto) {
    const tenantId = actor.tenantId;
    const companyId = this.toOptionalUuid(
      createAreaDto.companyId,
      'La empresa no es valida.',
    );
    const name = this.toName(
      createAreaDto.name,
      'El nombre del area no es valido.',
    );

    if (!companyId || !name) {
      throw new BadRequestException(
        'Empresa y nombre del area son obligatorios.',
      );
    }

    await this.assertCompany(tenantId, companyId);
    const slug = this.toSlug(createAreaDto.slug || name);
    await this.assertAreaSlugAvailable(companyId, slug);

    const area = await this.prisma.area.create({
      data: {
        tenantId,
        companyId,
        name,
        slug,
        description: this.toDescription(createAreaDto.description),
      },
      select: this.areaSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.area.created',
      entityType: 'Area',
      entityId: area.id,
      summary: `Se creo el area ${area.name}.`,
      after: this.toJson(this.organizationSnapshot(area)),
    });

    return area;
  }

  async updateArea(
    actor: AuthUser,
    areaId: string,
    updateAreaDto: UpdateAreaDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireId(areaId, 'El area es obligatoria.');
    const area = await this.findAreaOrThrow(tenantId, id);
    const name = this.toName(
      updateAreaDto.name,
      'El nombre del area no es valido.',
      false,
    );
    const status = this.normalizeOptionalStatus(updateAreaDto.status);
    const companyId = this.toOptionalUuid(
      updateAreaDto.companyId,
      'La empresa no es valida.',
    );
    const targetCompanyId = companyId ?? area.companyId;

    if (companyId && companyId !== area.companyId) {
      await this.assertCompany(tenantId, companyId);
      await this.assertSafeAreaCompanyChange(area, targetCompanyId);
    }

    const slug =
      updateAreaDto.slug !== undefined
        ? this.toSlug(updateAreaDto.slug || name || area.name)
        : undefined;

    if (slug && (slug !== area.slug || targetCompanyId !== area.companyId)) {
      await this.assertAreaSlugAvailable(targetCompanyId, slug, area.id);
    }

    const updatedArea = await this.prisma.area.update({
      where: { id: area.id },
      data: {
        ...(companyId ? { companyId } : {}),
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
        ...(updateAreaDto.description !== undefined
          ? { description: this.toDescription(updateAreaDto.description) }
          : {}),
        ...(status ? { status } : {}),
      },
      select: this.areaSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updatedArea.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.area.updated',
      entityType: 'Area',
      entityId: updatedArea.id,
      summary: `Se actualizo el area ${updatedArea.name}.`,
      before: this.toJson(this.organizationSnapshot(area)),
      after: this.toJson(this.organizationSnapshot(updatedArea)),
    });

    return updatedArea;
  }

  async createClient(actor: AuthUser, createClientDto: CreateClientDto) {
    const tenantId = actor.tenantId;
    const companyId = this.toOptionalUuid(
      createClientDto.companyId,
      'La empresa no es valida.',
    );
    const name = this.toName(
      createClientDto.name,
      'El nombre del cliente no es valido.',
    );

    if (!companyId || !name) {
      throw new BadRequestException(
        'Empresa y nombre del cliente son obligatorios.',
      );
    }

    await this.assertCompany(tenantId, companyId);
    const slug = this.toSlug(createClientDto.slug || name);
    await this.assertClientSlugAvailable(companyId, slug);

    const client = await this.prisma.client.create({
      data: {
        tenantId,
        companyId,
        name,
        slug,
        ruc: this.toOptionalText(createClientDto.ruc),
        description: this.toDescription(createClientDto.description),
      },
      select: this.clientSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.client.created',
      entityType: 'Client',
      entityId: client.id,
      summary: `Se creo el cliente ${client.name}.`,
      after: this.toJson(this.organizationSnapshot(client)),
    });

    return client;
  }

  async updateClient(
    actor: AuthUser,
    clientId: string,
    updateClientDto: UpdateClientDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireId(clientId, 'El cliente es obligatorio.');
    const client = await this.findClientOrThrow(tenantId, id);
    const companyId = this.toOptionalUuid(
      updateClientDto.companyId,
      'La empresa no es valida.',
    );
    const targetCompanyId = companyId ?? client.companyId;
    const name = this.toName(
      updateClientDto.name,
      'El nombre del cliente no es valido.',
      false,
    );
    const status = this.normalizeOptionalStatus(updateClientDto.status);

    if (companyId && companyId !== client.companyId) {
      await this.assertCompany(tenantId, companyId);
      await this.assertSafeClientCompanyChange(client, targetCompanyId);
    }

    const slug =
      updateClientDto.slug !== undefined
        ? this.toSlug(updateClientDto.slug || name || client.name)
        : undefined;

    if (
      slug &&
      (slug !== client.slug || targetCompanyId !== client.companyId)
    ) {
      await this.assertClientSlugAvailable(targetCompanyId, slug, client.id);
    }

    const updatedClient = await this.prisma.client.update({
      where: { id: client.id },
      data: {
        ...(companyId ? { companyId } : {}),
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
        ...(updateClientDto.ruc !== undefined
          ? { ruc: this.toOptionalText(updateClientDto.ruc) }
          : {}),
        ...(updateClientDto.description !== undefined
          ? { description: this.toDescription(updateClientDto.description) }
          : {}),
        ...(status ? { status } : {}),
      },
      select: this.clientSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updatedClient.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.client.updated',
      entityType: 'Client',
      entityId: updatedClient.id,
      summary: `Se actualizo el cliente ${updatedClient.name}.`,
      before: this.toJson(this.organizationSnapshot(client)),
      after: this.toJson(this.organizationSnapshot(updatedClient)),
    });

    return updatedClient;
  }

  async createJobPosition(
    actor: AuthUser,
    createJobPositionDto: CreateJobPositionDto,
  ) {
    const tenantId = actor.tenantId;
    const companyId = this.toOptionalUuid(
      createJobPositionDto.companyId,
      'La empresa no es valida.',
    );
    const scope = this.normalizePositionScope(createJobPositionDto.scope);
    const areaId = this.toOptionalUuid(
      createJobPositionDto.areaId,
      'El area no es valida.',
    );
    const name = this.toName(
      createJobPositionDto.name,
      'El nombre del cargo no es valido.',
    );

    if (!name) {
      throw new BadRequestException('El nombre del cargo es obligatorio.');
    }

    if (scope === JobPositionScope.COMPANY && !companyId) {
      throw new BadRequestException(
        'Empresa y nombre del cargo son obligatorios.',
      );
    }

    if (scope === JobPositionScope.COMPANY) {
      const scopedCompanyId = companyId;
      if (!scopedCompanyId) {
        throw new BadRequestException(
          'Empresa y nombre del cargo son obligatorios.',
        );
      }

      await this.assertCompany(tenantId, scopedCompanyId);
      await this.assertOptionalArea(tenantId, scopedCompanyId, areaId);
    }

    if (scope === JobPositionScope.GROUP && areaId) {
      throw new BadRequestException(
        'Un cargo de grupo completo no debe estar ligado a un area de empresa.',
      );
    }

    const slug = this.toSlug(createJobPositionDto.slug || name);
    await this.assertPositionSlugAvailable(tenantId, scope, companyId, slug);

    const position = await this.prisma.jobPosition.create({
      data: {
        tenantId,
        companyId: scope === JobPositionScope.COMPANY ? companyId : null,
        areaId: scope === JobPositionScope.COMPANY ? areaId : null,
        scope,
        name,
        slug,
        description: this.toDescription(createJobPositionDto.description),
      },
      select: this.positionSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: position.company?.id ?? null,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.position.created',
      entityType: 'JobPosition',
      entityId: position.id,
      summary: `Se creo el cargo ${position.name}.`,
      after: this.toJson(this.organizationSnapshot(position)),
    });

    return position;
  }

  async updateJobPosition(
    actor: AuthUser,
    positionId: string,
    updateJobPositionDto: UpdateJobPositionDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireId(positionId, 'El cargo es obligatorio.');
    const position = await this.findPositionOrThrow(tenantId, id);
    const companyId = this.toOptionalUuid(
      updateJobPositionDto.companyId,
      'La empresa no es valida.',
    );
    const scope = this.normalizeOptionalPositionScope(
      updateJobPositionDto.scope,
    );
    const areaId = this.toOptionalUuid(
      updateJobPositionDto.areaId,
      'El area no es valida.',
    );
    const name = this.toName(
      updateJobPositionDto.name,
      'El nombre del cargo no es valido.',
      false,
    );
    const status = this.normalizeOptionalStatus(updateJobPositionDto.status);
    const targetScope = scope ?? position.scope;
    const targetCompanyId =
      targetScope === JobPositionScope.GROUP
        ? null
        : (companyId ?? position.companyId);
    const targetAreaId =
      targetScope === JobPositionScope.GROUP
        ? null
        : updateJobPositionDto.areaId !== undefined
          ? areaId
          : position.areaId;

    if (targetScope === JobPositionScope.COMPANY && !targetCompanyId) {
      throw new BadRequestException(
        'Empresa y nombre del cargo son obligatorios.',
      );
    }

    if (companyId && companyId !== position.companyId) {
      await this.assertCompany(tenantId, companyId);
    }

    if (
      targetScope !== position.scope ||
      targetCompanyId !== position.companyId ||
      targetAreaId !== position.areaId
    ) {
      await this.assertSafePositionStructureChange(position, {
        targetAreaId,
        targetCompanyId,
        targetScope,
      });
    }

    if (targetScope === JobPositionScope.GROUP && areaId) {
      throw new BadRequestException(
        'Un cargo de grupo completo no debe estar ligado a un area de empresa.',
      );
    }

    if (
      targetScope === JobPositionScope.COMPANY &&
      updateJobPositionDto.areaId !== undefined
    ) {
      if (!targetCompanyId) {
        throw new BadRequestException(
          'Empresa y nombre del cargo son obligatorios.',
        );
      }

      await this.assertOptionalArea(tenantId, targetCompanyId, areaId);
    }

    const slug =
      updateJobPositionDto.slug !== undefined
        ? this.toSlug(updateJobPositionDto.slug || name || position.name)
        : undefined;

    if (
      slug &&
      (slug !== position.slug ||
        targetCompanyId !== position.companyId ||
        targetScope !== position.scope)
    ) {
      await this.assertPositionSlugAvailable(
        tenantId,
        targetScope,
        targetCompanyId,
        slug,
        position.id,
      );
    }

    const updatedPosition = await this.prisma.jobPosition.update({
      where: { id: position.id },
      data: {
        ...(scope ? { scope } : {}),
        ...(scope === JobPositionScope.GROUP
          ? { companyId: null, areaId: null }
          : {}),
        ...(targetScope === JobPositionScope.COMPANY && companyId
          ? { companyId }
          : {}),
        ...(targetScope === JobPositionScope.COMPANY &&
        updateJobPositionDto.areaId !== undefined
          ? { areaId }
          : {}),
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
        ...(updateJobPositionDto.description !== undefined
          ? {
              description: this.toDescription(updateJobPositionDto.description),
            }
          : {}),
        ...(status ? { status } : {}),
      },
      select: this.positionSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updatedPosition.company?.id ?? null,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.position.updated',
      entityType: 'JobPosition',
      entityId: updatedPosition.id,
      summary: `Se actualizo el cargo ${updatedPosition.name}.`,
      before: this.toJson(this.organizationSnapshot(position)),
      after: this.toJson(this.organizationSnapshot(updatedPosition)),
    });

    return updatedPosition;
  }

  async createWorkTeam(actor: AuthUser, createWorkTeamDto: CreateWorkTeamDto) {
    const tenantId = actor.tenantId;
    const companyId = this.toOptionalUuid(
      createWorkTeamDto.companyId,
      'La empresa no es valida.',
    );
    const areaId = this.toOptionalUuid(
      createWorkTeamDto.areaId,
      'El area no es valida.',
    );
    const clientId = this.toOptionalUuid(
      createWorkTeamDto.clientId,
      'El cliente no es valido.',
    );
    const leaderEmployeeId = this.toOptionalUuid(
      createWorkTeamDto.leaderEmployeeId,
      'El responsable no es valido.',
    );
    const name = this.toName(
      createWorkTeamDto.name,
      'El nombre del equipo no es valido.',
    );

    if (!companyId || !name) {
      throw new BadRequestException(
        'Empresa y nombre del equipo son obligatorios.',
      );
    }

    await this.assertCompany(tenantId, companyId);
    await this.assertOptionalArea(tenantId, companyId, areaId);
    await this.assertOptionalClient(tenantId, companyId, clientId);
    await this.assertOptionalEmployee(tenantId, companyId, leaderEmployeeId);
    const slug = this.toSlug(createWorkTeamDto.slug || name);
    await this.assertTeamSlugAvailable(companyId, slug);

    const team = await this.prisma.workTeam.create({
      data: {
        tenantId,
        companyId,
        areaId,
        clientId,
        leaderEmployeeId,
        name,
        slug,
        description: this.toDescription(createWorkTeamDto.description),
      },
      select: this.teamSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.team.created',
      entityType: 'WorkTeam',
      entityId: team.id,
      summary: `Se creo el equipo ${team.name}.`,
      after: this.toJson(this.organizationSnapshot(team)),
    });

    return team;
  }

  async updateWorkTeam(
    actor: AuthUser,
    teamId: string,
    updateWorkTeamDto: UpdateWorkTeamDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireId(teamId, 'El equipo es obligatorio.');
    const team = await this.findTeamOrThrow(tenantId, id);
    const companyId = this.toOptionalUuid(
      updateWorkTeamDto.companyId,
      'La empresa no es valida.',
    );
    const areaId = this.toOptionalUuid(
      updateWorkTeamDto.areaId,
      'El area no es valida.',
    );
    const clientId = this.toOptionalUuid(
      updateWorkTeamDto.clientId,
      'El cliente no es valido.',
    );
    const leaderEmployeeId = this.toOptionalUuid(
      updateWorkTeamDto.leaderEmployeeId,
      'El responsable no es valido.',
    );
    const name = this.toName(
      updateWorkTeamDto.name,
      'El nombre del equipo no es valido.',
      false,
    );
    const status = this.normalizeOptionalStatus(updateWorkTeamDto.status);
    const targetCompanyId = companyId ?? team.companyId;

    if (companyId && companyId !== team.companyId) {
      await this.assertCompany(tenantId, companyId);
    }

    if (
      companyId !== null ||
      (updateWorkTeamDto.areaId !== undefined && areaId !== team.areaId) ||
      (updateWorkTeamDto.clientId !== undefined && clientId !== team.clientId)
    ) {
      await this.assertSafeTeamStructureChange(team, {
        targetCompanyId,
        targetAreaId:
          updateWorkTeamDto.areaId !== undefined ? areaId : team.areaId,
        targetClientId:
          updateWorkTeamDto.clientId !== undefined ? clientId : team.clientId,
      });
    }

    if (updateWorkTeamDto.areaId !== undefined) {
      await this.assertOptionalArea(tenantId, targetCompanyId, areaId);
    }

    if (updateWorkTeamDto.clientId !== undefined) {
      await this.assertOptionalClient(tenantId, targetCompanyId, clientId);
    }

    if (updateWorkTeamDto.leaderEmployeeId !== undefined) {
      await this.assertOptionalEmployee(
        tenantId,
        targetCompanyId,
        leaderEmployeeId,
      );
    }

    const slug =
      updateWorkTeamDto.slug !== undefined
        ? this.toSlug(updateWorkTeamDto.slug || name || team.name)
        : undefined;

    if (slug && (slug !== team.slug || targetCompanyId !== team.companyId)) {
      await this.assertTeamSlugAvailable(targetCompanyId, slug, team.id);
    }

    const updatedTeam = await this.prisma.workTeam.update({
      where: { id: team.id },
      data: {
        ...(companyId ? { companyId } : {}),
        ...(updateWorkTeamDto.areaId !== undefined ? { areaId } : {}),
        ...(updateWorkTeamDto.clientId !== undefined ? { clientId } : {}),
        ...(updateWorkTeamDto.leaderEmployeeId !== undefined
          ? { leaderEmployeeId }
          : {}),
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
        ...(updateWorkTeamDto.description !== undefined
          ? { description: this.toDescription(updateWorkTeamDto.description) }
          : {}),
        ...(status ? { status } : {}),
      },
      select: this.teamSelect(),
    });

    await this.auditService.write({
      tenantId,
      companyId: updatedTeam.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.team.updated',
      entityType: 'WorkTeam',
      entityId: updatedTeam.id,
      summary: `Se actualizo el equipo ${updatedTeam.name}.`,
      before: this.toJson(this.organizationSnapshot(team)),
      after: this.toJson(this.organizationSnapshot(updatedTeam)),
    });

    return updatedTeam;
  }

  async updateWorkTeamMembers(
    actor: AuthUser,
    teamId: string,
    updateWorkTeamMembersDto: UpdateWorkTeamMembersDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireId(teamId, 'El equipo es obligatorio.');
    const team = await this.findTeamOrThrow(tenantId, id);
    const leaderEmployeeId = this.toOptionalUuid(
      updateWorkTeamMembersDto.leaderEmployeeId,
      'El responsable no es valido.',
    );
    const employeeIds = this.uniqueIds(updateWorkTeamMembersDto.employeeIds);
    const requiredEmployeeIds = leaderEmployeeId
      ? this.uniqueIds([...employeeIds, leaderEmployeeId])
      : employeeIds;

    if (requiredEmployeeIds.length > 0) {
      await this.assertEmployeesBelongToCompany(
        tenantId,
        team.companyId,
        requiredEmployeeIds,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: {
          tenantId,
          companyId: team.companyId,
          teamId: team.id,
          ...(employeeIds.length > 0 ? { id: { notIn: employeeIds } } : {}),
        },
        data: { teamId: null },
      });

      if (employeeIds.length > 0) {
        await tx.employee.updateMany({
          where: {
            tenantId,
            companyId: team.companyId,
            id: { in: employeeIds },
          },
          data: { teamId: team.id },
        });
      }

      await tx.workTeam.update({
        where: { id: team.id },
        data: { leaderEmployeeId },
      });
    });

    const updatedTeam = await this.findTeamOrThrow(tenantId, team.id);

    await this.auditService.write({
      tenantId,
      companyId: updatedTeam.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.team.members.updated',
      entityType: 'WorkTeam',
      entityId: updatedTeam.id,
      summary: `Se actualizaron integrantes del equipo ${updatedTeam.name}.`,
      before: this.toJson(this.organizationSnapshot(team)),
      after: this.toJson({
        ...this.organizationSnapshot(updatedTeam),
        employees: updatedTeam.employees.map((employee) => ({
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
        })),
        leader: updatedTeam.leader
          ? {
              id: updatedTeam.leader.id,
              name: `${updatedTeam.leader.firstName} ${updatedTeam.leader.lastName}`.trim(),
            }
          : null,
      }),
    });

    return updatedTeam;
  }

  async createAssignment(
    actor: AuthUser,
    dto: CreateEmployeeClientAssignmentDto,
  ) {
    const tenantId = actor.tenantId;
    const resolved = await this.resolveAssignmentInput(tenantId, dto);

    const assignment = await this.prisma.employeeClientAssignment.create({
      data: {
        tenantId,
        companyId: resolved.companyId,
        employeeId: resolved.employeeId,
        clientId: resolved.clientId,
        areaId: resolved.areaId,
        teamId: resolved.teamId,
        role: this.toOptionalText(dto.role),
        isPrimary: Boolean(dto.isPrimary),
        startsAt: this.parseOptionalDate(dto.startsAt),
        endsAt: this.parseOptionalDate(dto.endsAt),
      },
      select: this.assignmentSelect(),
    });

    await this.clearOtherPrimaryAssignments(assignment);

    await this.auditService.write({
      tenantId,
      companyId: assignment.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.assignment.created',
      entityType: 'EmployeeClientAssignment',
      entityId: assignment.id,
      summary: `Se asigno ${assignment.employee.firstName} ${assignment.employee.lastName} al cliente ${assignment.client.name}.`,
      after: this.toJson(this.assignmentSnapshot(assignment)),
    });

    return this.findAssignmentOrThrow(tenantId, assignment.id);
  }

  async updateAssignment(
    actor: AuthUser,
    assignmentId: string,
    dto: UpdateEmployeeClientAssignmentDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireId(assignmentId, 'La asignacion es obligatoria.');
    const current = await this.findAssignmentOrThrow(tenantId, id);
    const resolved =
      dto.employeeId !== undefined ||
      dto.clientId !== undefined ||
      dto.areaId !== undefined ||
      dto.teamId !== undefined
        ? await this.resolveAssignmentInput(tenantId, {
            employeeId: dto.employeeId ?? current.employee.id,
            clientId: dto.clientId ?? current.client.id,
            areaId: dto.areaId !== undefined ? dto.areaId : current.area?.id,
            teamId: dto.teamId !== undefined ? dto.teamId : current.team?.id,
          })
        : null;
    const status = this.normalizeOptionalStatus(dto.status);

    const updated = await this.prisma.employeeClientAssignment.update({
      where: { id: current.id },
      data: {
        ...(resolved
          ? {
              companyId: resolved.companyId,
              employeeId: resolved.employeeId,
              clientId: resolved.clientId,
              areaId: resolved.areaId,
              teamId: resolved.teamId,
            }
          : {}),
        ...(dto.role !== undefined
          ? { role: this.toOptionalText(dto.role) }
          : {}),
        ...(dto.isPrimary !== undefined
          ? { isPrimary: Boolean(dto.isPrimary) }
          : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: this.parseOptionalDate(dto.startsAt) }
          : {}),
        ...(dto.endsAt !== undefined
          ? { endsAt: this.parseOptionalDate(dto.endsAt) }
          : {}),
        ...(status ? { status } : {}),
      },
      select: this.assignmentSelect(),
    });

    await this.clearOtherPrimaryAssignments(updated);

    await this.auditService.write({
      tenantId,
      companyId: updated.company.id,
      actorType: 'user',
      actorLabel: this.actorLabel(actor),
      action: 'organization.assignment.updated',
      entityType: 'EmployeeClientAssignment',
      entityId: updated.id,
      summary: `Se actualizo la asignacion de ${updated.employee.firstName} ${updated.employee.lastName}.`,
      before: this.toJson(this.assignmentSnapshot(current)),
      after: this.toJson(this.assignmentSnapshot(updated)),
    });

    return updated;
  }

  private areaSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      createdAt: true,
      company: { select: { id: true, name: true, slug: true } },
      _count: {
        select: { employees: true, jobPositions: true, workTeams: true },
      },
    };
  }

  private positionSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      scope: true,
      status: true,
      createdAt: true,
      company: { select: { id: true, name: true, slug: true } },
      area: { select: { id: true, name: true, slug: true } },
      _count: { select: { employees: true } },
    };
  }

  private teamSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      createdAt: true,
      company: { select: { id: true, name: true, slug: true } },
      area: { select: { id: true, name: true, slug: true } },
      client: { select: { id: true, name: true, slug: true } },
      leader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      },
      employees: {
        orderBy: [{ firstName: 'asc' as const }, { lastName: 'asc' as const }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          status: true,
          areaRef: { select: { id: true, name: true, slug: true } },
          position: { select: { id: true, name: true, slug: true } },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
      },
      _count: { select: { employees: true } },
    };
  }

  private clientSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      ruc: true,
      description: true,
      status: true,
      createdAt: true,
      company: { select: { id: true, name: true, slug: true } },
      _count: { select: { workTeams: true, employeeClientAssignments: true } },
    };
  }

  private assignmentSelect() {
    return {
      id: true,
      role: true,
      isPrimary: true,
      status: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      company: { select: { id: true, name: true, slug: true } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      },
      client: { select: { id: true, name: true, slug: true } },
      area: { select: { id: true, name: true, slug: true } },
      team: { select: { id: true, name: true, slug: true } },
    };
  }

  private async assertCompany(tenantId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true },
    });

    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }
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
      select: { id: true, tenantId: true, companyId: true },
    });

    if (!area || area.tenantId !== tenantId || area.companyId !== companyId) {
      throw new BadRequestException(
        'El area seleccionada no pertenece a la empresa.',
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
      select: { id: true, tenantId: true, companyId: true },
    });

    if (
      !client ||
      client.tenantId !== tenantId ||
      client.companyId !== companyId
    ) {
      throw new BadRequestException(
        'El cliente seleccionado no pertenece a la empresa.',
      );
    }
  }

  private async assertOptionalEmployee(
    tenantId: string,
    companyId: string,
    employeeId: string | null,
  ) {
    if (!employeeId) {
      return;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, tenantId: true, companyId: true },
    });

    if (
      !employee ||
      employee.tenantId !== tenantId ||
      employee.companyId !== companyId
    ) {
      throw new BadRequestException(
        'El responsable seleccionado no pertenece a la empresa.',
      );
    }
  }

  private async assertEmployeesBelongToCompany(
    tenantId: string,
    companyId: string,
    employeeIds: string[],
  ) {
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        companyId,
        id: { in: employeeIds },
      },
      select: { id: true },
    });

    if (employees.length !== employeeIds.length) {
      throw new BadRequestException(
        'Uno o mas trabajadores no pertenecen a la empresa del equipo.',
      );
    }
  }

  private async findAreaOrThrow(tenantId: string, id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      select: { tenantId: true, companyId: true, ...this.areaSelect() },
    });

    if (!area || area.tenantId !== tenantId) {
      throw new BadRequestException('El area seleccionada no existe.');
    }

    return area;
  }

  private async findPositionOrThrow(tenantId: string, id: string) {
    const position = await this.prisma.jobPosition.findUnique({
      where: { id },
      select: {
        tenantId: true,
        companyId: true,
        areaId: true,
        ...this.positionSelect(),
      },
    });

    if (!position || position.tenantId !== tenantId) {
      throw new BadRequestException('El cargo seleccionado no existe.');
    }

    return position;
  }

  private async findTeamOrThrow(tenantId: string, id: string) {
    const team = await this.prisma.workTeam.findUnique({
      where: { id },
      select: {
        tenantId: true,
        companyId: true,
        areaId: true,
        clientId: true,
        leaderEmployeeId: true,
        ...this.teamSelect(),
      },
    });

    if (!team || team.tenantId !== tenantId) {
      throw new BadRequestException('El equipo seleccionado no existe.');
    }

    return team;
  }

  private async findClientOrThrow(tenantId: string, id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { tenantId: true, companyId: true, ...this.clientSelect() },
    });

    if (!client || client.tenantId !== tenantId) {
      throw new BadRequestException('El cliente seleccionado no existe.');
    }

    return client;
  }

  private async findAssignmentOrThrow(tenantId: string, id: string) {
    const assignment = await this.prisma.employeeClientAssignment.findUnique({
      where: { id },
      select: { tenantId: true, ...this.assignmentSelect() },
    });

    if (!assignment || assignment.tenantId !== tenantId) {
      throw new BadRequestException('La asignacion seleccionada no existe.');
    }

    return assignment;
  }

  private async assertSafeAreaCompanyChange(
    area: { id: string; name: string; companyId: string },
    targetCompanyId: string,
  ) {
    if (area.companyId === targetCompanyId) {
      return;
    }

    const [employees, positions, teams, assignments] = await Promise.all([
      this.prisma.employee.count({ where: { areaId: area.id } }),
      this.prisma.jobPosition.count({ where: { areaId: area.id } }),
      this.prisma.workTeam.count({ where: { areaId: area.id } }),
      this.prisma.employeeClientAssignment.count({
        where: { areaId: area.id },
      }),
    ]);

    this.throwStructuralImpact({
      entityLabel: `area ${area.name}`,
      operation:
        'cambiar la empresa de un area que ya participa en la operacion',
      impacts: [
        { label: 'Trabajadores vinculados', count: employees },
        { label: 'Cargos asociados', count: positions },
        { label: 'Equipos asociados', count: teams },
        { label: 'Asignaciones a clientes', count: assignments },
      ],
      recommendation:
        'Crea una nueva area en la empresa destino y mueve trabajadores o equipos desde un flujo de transferencia controlado.',
    });
  }

  private async assertSafeClientCompanyChange(
    client: { id: string; name: string; companyId: string },
    targetCompanyId: string,
  ) {
    if (client.companyId === targetCompanyId) {
      return;
    }

    const [teams, assignments] = await Promise.all([
      this.prisma.workTeam.count({ where: { clientId: client.id } }),
      this.prisma.employeeClientAssignment.count({
        where: { clientId: client.id },
      }),
    ]);

    this.throwStructuralImpact({
      entityLabel: `cliente ${client.name}`,
      operation:
        'cambiar la empresa de un cliente que ya tiene equipos o trabajadores asignados',
      impacts: [
        { label: 'Equipos asociados', count: teams },
        { label: 'Asignaciones de trabajadores', count: assignments },
      ],
      recommendation:
        'Crea el cliente en la empresa destino y registra nuevas asignaciones desde esa empresa para conservar el historial original.',
    });
  }

  private async assertSafePositionStructureChange(
    position: {
      id: string;
      name: string;
      companyId: string | null;
      areaId: string | null;
      scope: JobPositionScope;
    },
    target: {
      targetAreaId: string | null;
      targetCompanyId: string | null;
      targetScope: JobPositionScope;
    },
  ) {
    const areaChanged = position.areaId !== target.targetAreaId;
    const companyChanged = position.companyId !== target.targetCompanyId;
    const scopeChanged = position.scope !== target.targetScope;

    if (!areaChanged && !companyChanged && !scopeChanged) {
      return;
    }

    const employees = await this.prisma.employee.count({
      where: { positionId: position.id },
    });

    this.throwStructuralImpact({
      entityLabel: `cargo ${position.name}`,
      operation:
        'cambiar el alcance, empresa o area de un cargo usado por trabajadores',
      impacts: [{ label: 'Trabajadores con este cargo', count: employees }],
      recommendation:
        'Crea un nuevo cargo para la empresa o alcance destino y actualiza la ficha laboral de cada trabajador con evento historico.',
    });
  }

  private async assertSafeTeamStructureChange(
    team: {
      id: string;
      name: string;
      companyId: string;
      areaId: string | null;
      clientId: string | null;
    },
    target: {
      targetCompanyId: string;
      targetAreaId: string | null;
      targetClientId: string | null;
    },
  ) {
    const changed =
      team.companyId !== target.targetCompanyId ||
      team.areaId !== target.targetAreaId ||
      team.clientId !== target.targetClientId;

    if (!changed) {
      return;
    }

    const [employees, assignments] = await Promise.all([
      this.prisma.employee.count({ where: { teamId: team.id } }),
      this.prisma.employeeClientAssignment.count({
        where: { teamId: team.id },
      }),
    ]);

    this.throwStructuralImpact({
      entityLabel: `equipo ${team.name}`,
      operation:
        'cambiar empresa, area o cliente de un equipo que ya tiene personas o asignaciones',
      impacts: [
        { label: 'Trabajadores del equipo', count: employees },
        { label: 'Asignaciones a clientes', count: assignments },
      ],
      recommendation:
        'Crea un nuevo equipo con la estructura correcta y transfiere integrantes con un flujo que registre desde cuando aplica el cambio.',
    });
  }

  private throwStructuralImpact({
    entityLabel,
    impacts,
    operation,
    recommendation,
  }: {
    entityLabel: string;
    impacts: Array<{ label: string; count: number }>;
    operation: string;
    recommendation: string;
  }) {
    const activeImpacts = impacts.filter((impact) => impact.count > 0);

    if (activeImpacts.length === 0) {
      return;
    }

    throw new ConflictException({
      code: 'STRUCTURAL_IMPACT',
      title: 'Cambio protegido por historial',
      message: `No se puede ${operation} en ${entityLabel} porque ya tiene informacion relacionada.`,
      recommendation,
      impacts: activeImpacts,
      actions: [
        'Cancelar el cambio',
        'Crear una nueva estructura en la empresa destino',
        'Usar una transferencia controlada cuando ese flujo este disponible',
      ],
    });
  }

  private async resolveAssignmentInput(
    tenantId: string,
    dto: {
      employeeId?: string;
      clientId?: string;
      areaId?: string | null;
      teamId?: string | null;
    },
  ) {
    const employeeId = this.requireId(
      dto.employeeId,
      'El trabajador es obligatorio.',
    );
    const clientId = this.requireId(dto.clientId, 'El cliente es obligatorio.');
    const areaId = this.toOptionalUuid(dto.areaId, 'El area no es valida.');
    const teamId = this.toOptionalUuid(dto.teamId, 'El equipo no es valido.');

    const [employee, client, area, team] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, tenantId: true, companyId: true, status: true },
      }),
      this.prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, tenantId: true, companyId: true, status: true },
      }),
      areaId
        ? this.prisma.area.findUnique({
            where: { id: areaId },
            select: { id: true, tenantId: true, companyId: true },
          })
        : Promise.resolve(null),
      teamId
        ? this.prisma.workTeam.findUnique({
            where: { id: teamId },
            select: { id: true, tenantId: true, companyId: true },
          })
        : Promise.resolve(null),
    ]);

    if (
      !employee ||
      employee.tenantId !== tenantId ||
      employee.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'El trabajador seleccionado no existe o no esta activo.',
      );
    }

    if (!client || client.tenantId !== tenantId || client.status !== 'ACTIVE') {
      throw new BadRequestException(
        'El cliente seleccionado no existe o no esta activo.',
      );
    }

    if (employee.companyId !== client.companyId) {
      throw new BadRequestException(
        'El trabajador y el cliente deben pertenecer a la misma empresa.',
      );
    }

    if (
      areaId &&
      (!area ||
        area.tenantId !== tenantId ||
        area.companyId !== client.companyId)
    ) {
      throw new BadRequestException(
        'El area seleccionada no pertenece a la empresa del cliente.',
      );
    }

    if (
      teamId &&
      (!team ||
        team.tenantId !== tenantId ||
        team.companyId !== client.companyId)
    ) {
      throw new BadRequestException(
        'El equipo seleccionado no pertenece a la empresa del cliente.',
      );
    }

    return {
      companyId: client.companyId,
      employeeId: employee.id,
      clientId: client.id,
      areaId,
      teamId,
    };
  }

  private async assertAreaSlugAvailable(
    companyId: string,
    slug: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.area.findUnique({
      where: { companyId_slug: { companyId, slug } },
      select: { id: true },
    });

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(
        'Ya existe un area con ese identificador en la empresa.',
      );
    }
  }

  private async assertPositionSlugAvailable(
    tenantId: string,
    scope: JobPositionScope,
    companyId: string | null,
    slug: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.jobPosition.findFirst({
      where: {
        tenantId,
        scope,
        slug,
        companyId: scope === JobPositionScope.GROUP ? null : companyId,
      },
      select: { id: true },
    });

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(
        scope === JobPositionScope.GROUP
          ? 'Ya existe un cargo con ese identificador para todo el grupo.'
          : 'Ya existe un cargo con ese identificador en la empresa.',
      );
    }
  }

  private async assertTeamSlugAvailable(
    companyId: string,
    slug: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.workTeam.findUnique({
      where: { companyId_slug: { companyId, slug } },
      select: { id: true },
    });

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(
        'Ya existe un equipo con ese identificador en la empresa.',
      );
    }
  }

  private async assertClientSlugAvailable(
    companyId: string,
    slug: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.client.findUnique({
      where: { companyId_slug: { companyId, slug } },
      select: { id: true },
    });

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(
        'Ya existe un cliente con ese identificador en la empresa.',
      );
    }
  }

  private async clearOtherPrimaryAssignments(assignment: {
    id: string;
    employee: { id: string };
    isPrimary: boolean;
  }) {
    if (!assignment.isPrimary) {
      return;
    }

    await this.prisma.employeeClientAssignment.updateMany({
      where: {
        employeeId: assignment.employee.id,
        id: { not: assignment.id },
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
  }

  private organizationSnapshot(item: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: OrganizationStatus;
    company: { id: string; name: string } | null;
    scope?: JobPositionScope;
  }) {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      status: item.status,
      scope: item.scope,
      company: item.company
        ? {
            id: item.company.id,
            name: item.company.name,
          }
        : null,
    };
  }

  private assignmentSnapshot(item: {
    id: string;
    role: string | null;
    isPrimary: boolean;
    status: OrganizationStatus;
    employee: { id: string; firstName: string; lastName: string };
    client: { id: string; name: string };
    area: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
  }) {
    return {
      id: item.id,
      role: item.role,
      isPrimary: item.isPrimary,
      status: item.status,
      employee: {
        id: item.employee.id,
        name: `${item.employee.firstName} ${item.employee.lastName}`.trim(),
      },
      client: { id: item.client.id, name: item.client.name },
      area: item.area ? { id: item.area.id, name: item.area.name } : null,
      team: item.team ? { id: item.team.id, name: item.team.name } : null,
    };
  }

  private normalizePositionScope(value: unknown) {
    return (
      this.normalizeOptionalPositionScope(value) ?? JobPositionScope.COMPANY
    );
  }

  private normalizeOptionalPositionScope(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (
      value === JobPositionScope.COMPANY ||
      value === JobPositionScope.GROUP
    ) {
      return value;
    }

    throw new BadRequestException('El alcance del cargo no es valido.');
  }

  private actorLabel(actor: AuthUser) {
    return actor.email;
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private requireId(value: unknown, message: string) {
    const id = this.toOptionalUuid(value, message);

    if (!id) {
      throw new BadRequestException(message);
    }

    return id;
  }

  private toOptionalString(
    value: unknown,
    options: { field?: string; maxLength?: number; rejectHtml?: boolean } = {},
  ) {
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

    const field = options.field ?? 'El valor';
    const maxLength = options.maxLength ?? 240;
    const rejectHtml = options.rejectHtml ?? true;
    const normalized = String(value)
      .split('')
      .map((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127 ? ' ' : character;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.length > maxLength) {
      throw new BadRequestException(`${field} supera el maximo permitido.`);
    }

    if (rejectHtml && /[<>]/.test(normalized)) {
      throw new BadRequestException(`${field} no puede contener codigo HTML.`);
    }

    return normalized.length > 0 ? normalized : null;
  }

  private toName(value: unknown, message: string, required = true) {
    const normalized = this.toOptionalString(value, {
      field: 'El nombre',
      maxLength: 80,
    });

    if (!normalized) {
      if (required) {
        throw new BadRequestException(message);
      }

      return null;
    }

    if (!/^[\p{L}\p{N}][\p{L}\p{N}\s.'()&/_-]{1,79}$/u.test(normalized)) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private toDescription(value: unknown) {
    return this.toOptionalString(value, {
      field: 'La descripcion',
      maxLength: 420,
    });
  }

  private toOptionalText(value: unknown) {
    return this.toOptionalString(value, {
      field: 'El texto',
      maxLength: 120,
    });
  }

  private parseOptionalDate(value: unknown) {
    const normalized = this.toOptionalText(value);

    if (!normalized) {
      return null;
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha enviada no es valida.');
    }

    return date;
  }

  private toOptionalUuid(value: unknown, message: string) {
    const normalized = this.toOptionalString(value, {
      field: 'El identificador',
      maxLength: 64,
    });

    if (!normalized) {
      return null;
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        normalized,
      )
    ) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private uniqueIds(values: unknown) {
    if (!Array.isArray(values)) {
      return [];
    }

    if (values.length > 250) {
      throw new BadRequestException(
        'No puedes actualizar mas de 250 trabajadores en una sola accion.',
      );
    }

    return Array.from(
      new Set(
        values
          .map((value) =>
            this.toOptionalUuid(
              value,
              'Uno o mas trabajadores no son validos.',
            ),
          )
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }

  private toSlug(value: unknown) {
    const normalized = this.toOptionalString(value, {
      field: 'El identificador',
      maxLength: 80,
    });

    if (!normalized) {
      throw new BadRequestException('El identificador es obligatorio.');
    }

    const slug = normalized
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug || slug.length > 80) {
      throw new BadRequestException('El identificador no es valido.');
    }

    return slug;
  }

  private normalizeOptionalStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return undefined;
    }

    if (!(normalized in OrganizationStatus)) {
      throw new BadRequestException('El estado no es valido.');
    }

    return OrganizationStatus[normalized as keyof typeof OrganizationStatus];
  }
}
