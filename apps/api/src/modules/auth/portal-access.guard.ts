import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from './jwt-auth.guard';

@Injectable()
export class PortalAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();

    if (request.user?.employeeId) {
      return true;
    }

    throw new ForbiddenException(
      'Tu usuario no tiene acceso al portal trabajador.',
    );
  }
}
