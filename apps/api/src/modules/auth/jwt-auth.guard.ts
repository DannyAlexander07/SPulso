import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../database/prisma.service';
import { getJwtSecret, getJwtVerifyOptions } from '../../security/jwt-secret';

export type AuthUser = {
  sub: string;
  email: string;
  tenantId: string;
  companyId?: string | null;
  roleId: string | null;
  roleName?: string | null;
  permissions?: string[];
  employeeId?: string | null;
  themePreference?: 'light' | 'dark' | 'star';
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const token = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length)
      : null;

    if (!token) {
      throw new UnauthorizedException('Token requerido.');
    }

    try {
      const payload = jwt.verify(
        token,
        this.getJwtSecret(),
        getJwtVerifyOptions(),
      ) as AuthUser;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          tenantId: true,
          companyId: true,
          roleId: true,
          email: true,
          avatarUrl: true,
          status: true,
          themePreference: true,
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Sesion no valida.');
      }

      const role = user.roleId
        ? await this.prisma.role.findUnique({
            where: { id: user.roleId },
            select: {
              name: true,
              permissions: true,
            },
          })
        : null;
      const employee = await this.prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      request.user = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        companyId: user.companyId,
        roleId: user.roleId,
        roleName: role?.name ?? null,
        permissions: role?.permissions ?? [],
        employeeId: employee?.id ?? null,
        themePreference: user.themePreference.toLowerCase() as
          | 'light'
          | 'dark'
          | 'star',
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Token no valido.');
    }
  }

  private getJwtSecret() {
    return getJwtSecret();
  }
}
