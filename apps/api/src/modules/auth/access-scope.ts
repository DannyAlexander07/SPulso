import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from './jwt-auth.guard';

const GLOBAL_COMPANY_ROLES = new Set(['Super Admin', 'Admin Grupo']);

export function hasPrivilegedRole(actor: AuthUser) {
  return GLOBAL_COMPANY_ROLES.has(actor.roleName ?? '');
}

export function hasGlobalCompanyAccess(actor: AuthUser) {
  return hasPrivilegedRole(actor) && !actor.companyId;
}

export function isManagerScoped(actor: AuthUser) {
  return actor.roleName === 'Jefe de Area';
}

export function employeeVisibilityScope(
  actor: AuthUser,
): Prisma.EmployeeWhereInput {
  if (!isManagerScoped(actor)) return {};

  if (!actor.employeeId) {
    throw new ForbiddenException(
      'El rol Jefe de Area requiere una ficha laboral vinculada.',
    );
  }

  return {
    OR: [
      { id: actor.employeeId },
      { managerId: actor.employeeId },
      { team: { leaderEmployeeId: actor.employeeId } },
    ],
  };
}

export function scopedCompanyId(actor: AuthUser, requestedCompanyId?: unknown) {
  const requested = toOptionalString(requestedCompanyId);

  if (hasGlobalCompanyAccess(actor)) {
    return requested;
  }

  if (!actor.companyId) {
    throw new ForbiddenException('Tu usuario no tiene empresa asignada.');
  }

  if (requested && requested !== actor.companyId) {
    throw new ForbiddenException('No tienes acceso a esta empresa.');
  }

  return actor.companyId;
}

export function assertCompanyAccess(actor: AuthUser, companyId?: unknown) {
  const targetCompanyId = toOptionalString(companyId);

  if (hasGlobalCompanyAccess(actor)) {
    return;
  }

  if (
    !actor.companyId ||
    !targetCompanyId ||
    targetCompanyId !== actor.companyId
  ) {
    throw new ForbiddenException('No tienes acceso a esta empresa.');
  }
}

function toOptionalString(value: unknown) {
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
