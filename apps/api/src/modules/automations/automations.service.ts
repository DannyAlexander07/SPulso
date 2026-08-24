import { BadRequestException, Injectable } from '@nestjs/common';
import { AutomationRuleType, NotificationPriority } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { assertCompanyAccess } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

const defaultRules = [
  {
    type: AutomationRuleType.DOCUMENT_EXPIRED,
    name: 'Documentos vencidos',
    description:
      'Crea una alerta critica cuando un documento ya paso su fecha de vencimiento.',
    priority: NotificationPriority.CRITICAL,
  },
  {
    type: AutomationRuleType.DOCUMENT_EXPIRING,
    name: 'Documentos por vencer',
    description:
      'Avisa antes de que un contrato, certificado o politica llegue a su vencimiento.',
    priority: NotificationPriority.WARNING,
    thresholdDays: 30,
  },
  {
    type: AutomationRuleType.DOCUMENT_PENDING_SIGNATURE,
    name: 'Firmas pendientes',
    description: 'Detecta documentos que aun esperan firma o aceptacion.',
    priority: NotificationPriority.WARNING,
  },
  {
    type: AutomationRuleType.REQUEST_PENDING,
    name: 'Solicitudes sin respuesta',
    description:
      'Escala solicitudes que siguen pendientes despues del tiempo configurado.',
    priority: NotificationPriority.WARNING,
    thresholdHours: 48,
  },
  {
    type: AutomationRuleType.ATTENDANCE_LATE_REPEATED,
    name: 'Tardanzas repetidas',
    description:
      'Avisa cuando una persona acumula tardanzas dentro de una ventana de dias.',
    priority: NotificationPriority.WARNING,
    thresholdCount: 3,
    windowDays: 7,
  },
] as const;

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    await this.ensureDefaultRules(tenantId);

    return this.prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: this.ruleSelect(),
    });
  }

  async getEnabledRules(tenantId: string) {
    await this.ensureDefaultRules(tenantId);

    return this.prisma.automationRule.findMany({
      where: {
        enabled: true,
        tenantId,
      },
      orderBy: { createdAt: 'asc' },
      select: this.ruleSelect(),
    });
  }

  async update(
    actor: AuthUser,
    id: string,
    updateAutomationRuleDto: UpdateAutomationRuleDto,
  ) {
    const tenantId = actor.tenantId;
    await this.ensureDefaultRules(tenantId);

    const ruleId = this.toOptionalString(id);

    if (!ruleId) {
      throw new BadRequestException('La regla es obligatoria.');
    }

    const rule = await this.prisma.automationRule.findUnique({
      where: { id: ruleId },
      select: { companyId: true, id: true, tenantId: true },
    });

    if (!rule || rule.tenantId !== tenantId) {
      throw new BadRequestException('La regla seleccionada no existe.');
    }

    assertCompanyAccess(actor, rule.companyId);

    return this.prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        ...(updateAutomationRuleDto.enabled !== undefined
          ? { enabled: Boolean(updateAutomationRuleDto.enabled) }
          : {}),
        ...(updateAutomationRuleDto.priority !== undefined
          ? {
              priority: this.normalizePriority(
                updateAutomationRuleDto.priority,
              ),
            }
          : {}),
        ...(updateAutomationRuleDto.thresholdCount !== undefined
          ? {
              thresholdCount: this.normalizeOptionalPositiveInt(
                updateAutomationRuleDto.thresholdCount,
                1,
                30,
              ),
            }
          : {}),
        ...(updateAutomationRuleDto.thresholdDays !== undefined
          ? {
              thresholdDays: this.normalizeOptionalPositiveInt(
                updateAutomationRuleDto.thresholdDays,
                1,
                365,
              ),
            }
          : {}),
        ...(updateAutomationRuleDto.thresholdHours !== undefined
          ? {
              thresholdHours: this.normalizeOptionalPositiveInt(
                updateAutomationRuleDto.thresholdHours,
                1,
                720,
              ),
            }
          : {}),
        ...(updateAutomationRuleDto.windowDays !== undefined
          ? {
              windowDays: this.normalizeOptionalPositiveInt(
                updateAutomationRuleDto.windowDays,
                1,
                90,
              ),
            }
          : {}),
      },
      select: this.ruleSelect(),
    });
  }

  private async ensureDefaultRules(tenantId: string) {
    await Promise.all(
      defaultRules.map(async (rule) => {
        const existingRule = await this.prisma.automationRule.findFirst({
          where: {
            companyId: null,
            tenantId,
            type: rule.type,
          },
          select: { id: true },
        });

        if (existingRule) {
          await this.prisma.automationRule.update({
            where: { id: existingRule.id },
            data: {
              description: rule.description,
              name: rule.name,
            },
          });
          return;
        }

        await this.prisma.automationRule.create({
          data: {
            tenantId,
            companyId: null,
            name: rule.name,
            description: rule.description,
            enabled: true,
            priority: rule.priority,
            thresholdCount:
              'thresholdCount' in rule ? rule.thresholdCount : null,
            thresholdDays: 'thresholdDays' in rule ? rule.thresholdDays : null,
            thresholdHours:
              'thresholdHours' in rule ? rule.thresholdHours : null,
            windowDays: 'windowDays' in rule ? rule.windowDays : null,
            type: rule.type,
          },
        });
      }),
    );
  }

  private ruleSelect() {
    return {
      id: true,
      type: true,
      name: true,
      description: true,
      enabled: true,
      thresholdDays: true,
      thresholdHours: true,
      thresholdCount: true,
      windowDays: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    };
  }

  private normalizePriority(value: unknown) {
    const normalized = this.toOptionalString(value);

    if (!normalized || !(normalized in NotificationPriority)) {
      throw new BadRequestException('La prioridad no es valida.');
    }

    return NotificationPriority[
      normalized as keyof typeof NotificationPriority
    ];
  }

  private normalizeOptionalPositiveInt(
    value: unknown,
    min: number,
    max: number,
  ) {
    const normalized = this.toOptionalString(value);

    if (!normalized) {
      return null;
    }

    const numberValue = Number(normalized);

    if (
      !Number.isInteger(numberValue) ||
      numberValue < min ||
      numberValue > max
    ) {
      throw new BadRequestException(
        `El valor debe estar entre ${min} y ${max}.`,
      );
    }

    return numberValue;
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
