import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from './jwt-auth.guard';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const permissions = request.user?.permissions ?? [];
    const hasEveryPermission = requiredPermissions.every((permission) =>
      permissions.includes(permission),
    );

    if (hasEveryPermission) {
      return true;
    }

    throw new ForbiddenException(
      'No tienes permisos para realizar esta accion.',
    );
  }
}
