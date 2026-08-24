import { BadRequestException, Injectable } from '@nestjs/common';
import { BenefitAudienceScope, BenefitStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { hasGlobalCompanyAccess } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { CreateBenefitDto, UpdateBenefitDto } from './dto/benefit.dto';

type BenefitRecord = {
  id: string;
  title: string;
  category: string;
  description: string;
  status: BenefitStatus;
  audienceScope: BenefitAudienceScope;
  startsAt: Date | null;
  endsAt: Date | null;
  actionLabel: string | null;
  actionUrl: string | null;
  imageUrl: string | null;
  isHighlighted: boolean;
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
  }>;
};

@Injectable()
export class BenefitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    filters?: {
      companyId?: string;
      scope?: string;
      search?: string;
      status?: string;
    },
  ) {
    const companyId = this.toOptionalString(filters?.companyId);
    const search = this.toOptionalString(filters?.search);
    const status = this.normalizeOptionalStatus(filters?.status);
    const scope = this.normalizeOptionalScope(filters?.scope);
    const where: Prisma.BenefitWhereInput = { tenantId };

    if (status) {
      where.status = status;
    }

    if (scope) {
      where.audienceScope = scope;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (companyId) {
      where.AND = [
        {
          OR: [
            { audienceScope: BenefitAudienceScope.ALL },
            { audiences: { some: { companyId } } },
            { audiences: { some: { team: { companyId } } } },
          ],
        },
      ];
    }

    const benefits = await this.prisma.benefit.findMany({
      where,
      orderBy: [{ isHighlighted: 'desc' }, { updatedAt: 'desc' }],
      select: this.benefitSelect(),
    });

    const summary = {
      total: benefits.length,
      active: benefits.filter(
        (benefit) => benefit.status === BenefitStatus.ACTIVE,
      ).length,
      highlighted: benefits.filter((benefit) => benefit.isHighlighted).length,
      segmented: benefits.filter(
        (benefit) => benefit.audienceScope !== BenefitAudienceScope.ALL,
      ).length,
    };

    return { data: benefits, summary };
  }

  async create(actor: AuthUser, createBenefitDto: CreateBenefitDto) {
    const tenantId = actor.tenantId;
    const title = this.requireSafeText(
      createBenefitDto.title,
      'El titulo es obligatorio.',
      90,
    );
    const category = this.requireSafeText(
      createBenefitDto.category,
      'La categoria es obligatoria.',
      60,
    );
    const description = this.requireSafeText(
      createBenefitDto.description,
      'La descripcion es obligatoria.',
      520,
    );
    const audienceScope = this.normalizeScope(createBenefitDto.audienceScope);
    const status = this.normalizeStatus(
      createBenefitDto.status ?? BenefitStatus.DRAFT,
    );
    const companyIds = this.uniqueIds(createBenefitDto.companyIds);
    const teamIds = this.uniqueIds(createBenefitDto.teamIds);

    await this.assertAudience(tenantId, audienceScope, companyIds, teamIds);
    await this.assertScopedAudience(actor, audienceScope, companyIds, teamIds);

    const benefit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.benefit.create({
        data: {
          tenantId,
          title,
          category,
          description,
          status,
          audienceScope,
          startsAt: this.toOptionalDate(createBenefitDto.startsAt),
          endsAt: this.toOptionalDate(createBenefitDto.endsAt),
          actionLabel: this.toOptionalSafeString(
            createBenefitDto.actionLabel,
            50,
            'El texto del boton',
          ),
          actionUrl: this.toOptionalSafeString(
            createBenefitDto.actionUrl,
            280,
            'El enlace',
          ),
          imageUrl: this.toOptionalSafeString(
            createBenefitDto.imageUrl,
            500,
            'La imagen',
          ),
          isHighlighted: Boolean(createBenefitDto.isHighlighted),
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
      );

      return this.readBenefitSnapshot(tx, tenantId, created.id);
    });

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: actor.email,
      action: 'benefit.created',
      entityType: 'Benefit',
      entityId: benefit.id,
      summary: `Se creo el beneficio ${benefit.title}.`,
      after: this.toJson(this.benefitSnapshot(benefit)),
    });

    return benefit;
  }

  async update(
    actor: AuthUser,
    benefitId: string,
    updateBenefitDto: UpdateBenefitDto,
  ) {
    const tenantId = actor.tenantId;
    const id = this.requireText(benefitId, 'El beneficio es obligatorio.');
    const current = await this.findBenefitOrThrow(tenantId, id);
    const audienceScope =
      updateBenefitDto.audienceScope !== undefined
        ? this.normalizeScope(updateBenefitDto.audienceScope)
        : current.audienceScope;
    const companyIds =
      updateBenefitDto.companyIds !== undefined
        ? this.uniqueIds(updateBenefitDto.companyIds)
        : current.audiences.flatMap((audience) =>
            audience.company ? [audience.company.id] : [],
          );
    const teamIds =
      updateBenefitDto.teamIds !== undefined
        ? this.uniqueIds(updateBenefitDto.teamIds)
        : current.audiences.flatMap((audience) =>
            audience.team ? [audience.team.id] : [],
          );
    const shouldReplaceAudience =
      updateBenefitDto.audienceScope !== undefined ||
      updateBenefitDto.companyIds !== undefined ||
      updateBenefitDto.teamIds !== undefined;

    await this.assertScopedAudience(
      actor,
      current.audienceScope,
      current.audiences.flatMap((audience) =>
        audience.company ? [audience.company.id] : [],
      ),
      current.audiences.flatMap((audience) =>
        audience.team ? [audience.team.id] : [],
      ),
    );

    if (shouldReplaceAudience) {
      await this.assertAudience(tenantId, audienceScope, companyIds, teamIds);
      await this.assertScopedAudience(
        actor,
        audienceScope,
        companyIds,
        teamIds,
      );
    }

    const updatedBenefit = await this.prisma.$transaction(async (tx) => {
      await tx.benefit.update({
        where: { id: current.id },
        data: {
          ...(updateBenefitDto.title !== undefined
            ? {
                title: this.requireSafeText(
                  updateBenefitDto.title,
                  'El titulo es obligatorio.',
                  90,
                ),
              }
            : {}),
          ...(updateBenefitDto.category !== undefined
            ? {
                category: this.requireSafeText(
                  updateBenefitDto.category,
                  'La categoria es obligatoria.',
                  60,
                ),
              }
            : {}),
          ...(updateBenefitDto.description !== undefined
            ? {
                description: this.requireSafeText(
                  updateBenefitDto.description,
                  'La descripcion es obligatoria.',
                  520,
                ),
              }
            : {}),
          ...(updateBenefitDto.status !== undefined
            ? { status: this.normalizeStatus(updateBenefitDto.status) }
            : {}),
          ...(updateBenefitDto.audienceScope !== undefined
            ? { audienceScope }
            : {}),
          ...(updateBenefitDto.startsAt !== undefined
            ? { startsAt: this.toOptionalDate(updateBenefitDto.startsAt) }
            : {}),
          ...(updateBenefitDto.endsAt !== undefined
            ? { endsAt: this.toOptionalDate(updateBenefitDto.endsAt) }
            : {}),
          ...(updateBenefitDto.actionLabel !== undefined
            ? {
                actionLabel: this.toOptionalSafeString(
                  updateBenefitDto.actionLabel,
                  50,
                  'El texto del boton',
                ),
              }
            : {}),
          ...(updateBenefitDto.actionUrl !== undefined
            ? {
                actionUrl: this.toOptionalSafeString(
                  updateBenefitDto.actionUrl,
                  280,
                  'El enlace',
                ),
              }
            : {}),
          ...(updateBenefitDto.imageUrl !== undefined
            ? {
                imageUrl: this.toOptionalSafeString(
                  updateBenefitDto.imageUrl,
                  500,
                  'La imagen',
                ),
              }
            : {}),
          ...(updateBenefitDto.isHighlighted !== undefined
            ? { isHighlighted: Boolean(updateBenefitDto.isHighlighted) }
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
        );
      }

      return this.readBenefitSnapshot(tx, tenantId, current.id);
    });

    await this.auditService.write({
      tenantId,
      actorType: 'user',
      actorLabel: actor.email,
      action: 'benefit.updated',
      entityType: 'Benefit',
      entityId: updatedBenefit.id,
      summary: `Se actualizo el beneficio ${updatedBenefit.title}.`,
      before: this.toJson(this.benefitSnapshot(current)),
      after: this.toJson(this.benefitSnapshot(updatedBenefit)),
    });

    return updatedBenefit;
  }

  private benefitSelect() {
    return {
      ...this.benefitScalarSelect(),
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
        },
      },
    };
  }

  private benefitScalarSelect() {
    return {
      id: true,
      title: true,
      category: true,
      description: true,
      status: true,
      audienceScope: true,
      startsAt: true,
      endsAt: true,
      actionLabel: true,
      actionUrl: true,
      imageUrl: true,
      isHighlighted: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private async readBenefitSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    benefitId: string,
  ): Promise<BenefitRecord> {
    const benefit = await tx.benefit.findFirst({
      where: { id: benefitId, tenantId },
      select: this.benefitScalarSelect(),
    });
    if (!benefit) {
      throw new BadRequestException(
        'El beneficio cambio mientras se guardaba. Intenta nuevamente.',
      );
    }
    const links = await tx.benefitAudience.findMany({
      where: { benefitId, tenantId },
      select: { id: true, companyId: true, teamId: true },
    });
    const teamIds = links.flatMap((link) => (link.teamId ? [link.teamId] : []));
    const teams = await tx.workTeam.findMany({
      where: { id: { in: teamIds }, tenantId },
      select: { id: true, name: true, slug: true, companyId: true },
    });
    const companyIds = [
      ...links.flatMap((link) => (link.companyId ? [link.companyId] : [])),
      ...teams.map((team) => team.companyId),
    ];
    const companies = await tx.company.findMany({
      where: { id: { in: [...new Set(companyIds)] }, tenantId },
      select: { id: true, name: true, slug: true },
    });
    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const audiences: BenefitRecord['audiences'] = links.map((link) => {
      const team = link.teamId ? teamById.get(link.teamId) : undefined;
      const company = link.companyId
        ? companyById.get(link.companyId)
        : undefined;
      if (
        (link.companyId && !company) ||
        (link.teamId && (!team || !companyById.has(team.companyId)))
      ) {
        throw new BadRequestException(
          'La audiencia cambio mientras se guardaba el beneficio.',
        );
      }
      return {
        id: link.id,
        company: company ?? null,
        team: team
          ? { ...team, company: companyById.get(team.companyId)! }
          : null,
      };
    });

    return { ...benefit, audiences };
  }

  private async findBenefitOrThrow(tenantId: string, id: string) {
    const benefit = await this.prisma.benefit.findUnique({
      where: { id },
      select: this.benefitSelect(),
    });

    if (!benefit || !(await this.belongsToTenant(tenantId, benefit.id))) {
      throw new BadRequestException('El beneficio seleccionado no existe.');
    }

    return benefit;
  }

  private async belongsToTenant(tenantId: string, id: string) {
    const benefit = await this.prisma.benefit.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    return benefit?.tenantId === tenantId;
  }

  private async replaceAudiences(
    tx: Prisma.TransactionClient,
    tenantId: string,
    benefitId: string,
    audienceScope: BenefitAudienceScope,
    companyIds: string[],
    teamIds: string[],
  ) {
    await tx.benefitAudience.deleteMany({ where: { benefitId } });

    if (
      audienceScope === BenefitAudienceScope.COMPANIES &&
      companyIds.length > 0
    ) {
      await tx.benefitAudience.createMany({
        data: companyIds.map((companyId) => ({
          tenantId,
          benefitId,
          companyId,
        })),
      });
    }

    if (audienceScope === BenefitAudienceScope.TEAMS && teamIds.length > 0) {
      await tx.benefitAudience.createMany({
        data: teamIds.map((teamId) => ({ tenantId, benefitId, teamId })),
      });
    }
  }

  private async assertAudience(
    tenantId: string,
    audienceScope: BenefitAudienceScope,
    companyIds: string[],
    teamIds: string[],
  ) {
    if (audienceScope === BenefitAudienceScope.COMPANIES) {
      if (companyIds.length === 0) {
        throw new BadRequestException('Selecciona al menos una empresa.');
      }

      const companies = await this.prisma.company.findMany({
        where: { tenantId, id: { in: companyIds } },
        select: { id: true },
      });

      if (companies.length !== companyIds.length) {
        throw new BadRequestException(
          'Una o mas empresas seleccionadas no existen.',
        );
      }
    }

    if (audienceScope === BenefitAudienceScope.TEAMS) {
      if (teamIds.length === 0) {
        throw new BadRequestException('Selecciona al menos un equipo.');
      }

      const teams = await this.prisma.workTeam.findMany({
        where: { tenantId, id: { in: teamIds } },
        select: { id: true },
      });

      if (teams.length !== teamIds.length) {
        throw new BadRequestException(
          'Uno o mas equipos seleccionados no existen.',
        );
      }
    }
  }

  private async assertScopedAudience(
    actor: AuthUser,
    audienceScope: BenefitAudienceScope,
    companyIds: string[],
    teamIds: string[],
  ) {
    if (hasGlobalCompanyAccess(actor)) {
      return;
    }

    if (!actor.companyId) {
      throw new BadRequestException('Tu usuario no tiene empresa asignada.');
    }

    if (audienceScope === BenefitAudienceScope.ALL) {
      throw new BadRequestException(
        'Solo un administrador global puede publicar beneficios para todas las empresas.',
      );
    }

    if (
      audienceScope === BenefitAudienceScope.COMPANIES &&
      companyIds.some((companyId) => companyId !== actor.companyId)
    ) {
      throw new BadRequestException(
        'No puedes publicar beneficios para otra empresa.',
      );
    }

    if (audienceScope === BenefitAudienceScope.TEAMS && teamIds.length > 0) {
      const teams = await this.prisma.workTeam.count({
        where: {
          id: { in: teamIds },
          tenantId: actor.tenantId,
          companyId: actor.companyId,
        },
      });

      if (teams !== teamIds.length) {
        throw new BadRequestException(
          'No puedes publicar beneficios para equipos de otra empresa.',
        );
      }
    }
  }

  private benefitSnapshot(benefit: {
    id: string;
    title: string;
    category: string;
    status: BenefitStatus;
    audienceScope: BenefitAudienceScope;
  }) {
    return {
      id: benefit.id,
      title: benefit.title,
      category: benefit.category,
      status: benefit.status,
      audienceScope: benefit.audienceScope,
    };
  }

  private normalizeStatus(value: unknown) {
    const normalized = this.requireText(value, 'El estado es obligatorio.');

    if (!(normalized in BenefitStatus)) {
      throw new BadRequestException('El estado no es valido.');
    }

    return BenefitStatus[normalized as keyof typeof BenefitStatus];
  }

  private normalizeOptionalStatus(value: unknown) {
    const normalized = this.toOptionalString(value);

    return normalized ? this.normalizeStatus(normalized) : undefined;
  }

  private normalizeScope(value: unknown) {
    const normalized = this.requireText(
      value ?? BenefitAudienceScope.ALL,
      'El alcance es obligatorio.',
    );

    if (!(normalized in BenefitAudienceScope)) {
      throw new BadRequestException('El alcance no es valido.');
    }

    return BenefitAudienceScope[
      normalized as keyof typeof BenefitAudienceScope
    ];
  }

  private normalizeOptionalScope(value: unknown) {
    const normalized = this.toOptionalString(value);

    return normalized ? this.normalizeScope(normalized) : undefined;
  }

  private toOptionalDate(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha no es valida.');
    }

    return date;
  }

  private requireText(value: unknown, message: string) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private requireSafeText(value: unknown, message: string, maxLength: number) {
    const normalized = this.requireText(value, message);

    return this.assertSafeText(normalized, maxLength, message);
  }

  private toOptionalSafeString(
    value: unknown,
    maxLength: number,
    label: string,
  ) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    return this.assertSafeText(normalized, maxLength, `${label} no es valido.`);
  }

  private assertSafeText(value: string, maxLength: number, message: string) {
    if (value.length > maxLength) {
      throw new BadRequestException(`Maximo ${maxLength} caracteres.`);
    }

    if (/[<>]/.test(value)) {
      throw new BadRequestException(message);
    }

    return value;
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

  private uniqueIds(values: unknown) {
    if (!Array.isArray(values)) {
      return [];
    }

    const ids = Array.from(
      new Set(
        values
          .map((value) => this.toOptionalString(value))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (ids.length > 100) {
      throw new BadRequestException('Selecciona como maximo 100 audiencias.');
    }

    return ids;
  }

  private toJson(value: unknown) {
    return value as Prisma.InputJsonValue;
  }
}
