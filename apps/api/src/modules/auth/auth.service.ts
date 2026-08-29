import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Prisma, ThemePreference } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  getJwtSecret,
  getJwtSignOptions,
  getJwtVerifyOptions,
} from '../../security/jwt-secret';
import type { LoginDto } from './dto/login.dto';
import type { UpdateThemePreferenceDto } from './dto/update-theme-preference.dto';
import type { AuthUser } from './jwt-auth.guard';

type AuthTokenPayload = {
  sub: string;
  email: string;
  tenantId: string;
  roleId: string | null;
  roleName?: string | null;
  permissions?: string[];
  sessionVersion: number;
};

type LoginSecurityRow = {
  passwordHash: string;
  failedLoginAttempts: number;
  loginLockedUntil: Date | null;
};

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'spulso-invalid-password-comparison-only',
  12,
);
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(loginDto: LoginDto) {
    const email = this.toOptionalString(loginDto.email)?.toLowerCase();
    const password = this.toOptionalString(loginDto.password);

    if (!email || !password) {
      throw new BadRequestException('Correo y contraseña son obligatorios.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new BadRequestException('Correo o contraseña no validos.');
    }

    if (password.length < 8 || password.length > 128) {
      throw new BadRequestException('Correo o contraseña no validos.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        sessionVersion: true,
        themePreference: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const passwordMatches = await this.verifyPasswordAtomically(
      user.id,
      password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const role = await this.findPublicRole(user.roleId);
    const employee = await this.findPublicEmployee(user.id);
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roleId: user.roleId,
        roleName: role?.name ?? null,
        permissions: role?.permissions ?? [],
        sessionVersion: user.sessionVersion,
      },
      this.getJwtSecret(),
      getJwtSignOptions(),
    );

    return {
      accessToken,
      user: this.toPublicUser({ ...user, role, employee }),
    };
  }

  private async verifyPasswordAtomically(userId: string, password: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LoginSecurityRow[]>(Prisma.sql`
        SELECT
          "passwordHash",
          "failedLoginAttempts",
          "loginLockedUntil"
        FROM "User"
        WHERE "id" = ${userId}
        FOR UPDATE
      `);
      const security = rows[0];
      if (!security) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        return false;
      }

      const passwordMatches = await bcrypt.compare(
        password,
        security.passwordHash,
      );
      const now = new Date();
      if (
        security.loginLockedUntil &&
        security.loginLockedUntil.getTime() > now.getTime()
      ) {
        return false;
      }

      if (!passwordMatches) {
        const priorAttempts = security.loginLockedUntil
          ? 0
          : security.failedLoginAttempts;
        const failedLoginAttempts = priorAttempts + 1;
        const mustLock = failedLoginAttempts >= MAX_FAILED_LOGINS;
        await tx.user.update({
          where: { id: userId },
          data: {
            failedLoginAttempts: mustLock ? 0 : failedLoginAttempts,
            lastFailedLoginAt: now,
            loginLockedUntil: mustLock
              ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000)
              : null,
          },
          select: { id: true },
        });
        return false;
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          loginLockedUntil: null,
        },
        select: { id: true },
      });
      return true;
    });
  }

  async me(authorization?: string) {
    const payload = this.verifyAuthorizationHeader(authorization);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        sessionVersion: true,
        themePreference: true,
      },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      payload.sessionVersion !== user.sessionVersion
    ) {
      throw new UnauthorizedException('Sesión no valida.');
    }

    const role = await this.findPublicRole(user.roleId);
    const employee = await this.findPublicEmployee(user.id);

    return this.toPublicUser({ ...user, role, employee });
  }

  async logout(actor: AuthUser) {
    await this.prisma.user.update({
      where: { id: actor.sub },
      data: { sessionVersion: { increment: 1 } },
      select: { id: true },
    });

    return { ok: true };
  }

  async updateThemePreference(
    actor: AuthUser,
    updateThemeDto: UpdateThemePreferenceDto,
  ) {
    const themePreference = this.toThemePreference(
      updateThemeDto.themePreference,
    );

    const user = await this.prisma.user.update({
      where: { id: actor.sub },
      data: { themePreference },
      select: {
        themePreference: true,
      },
    });

    return {
      themePreference: this.toPublicThemePreference(user.themePreference),
    };
  }

  private verifyAuthorizationHeader(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null;

    if (!token) {
      throw new UnauthorizedException('Token requerido.');
    }

    try {
      return jwt.verify(
        token,
        this.getJwtSecret(),
        getJwtVerifyOptions(),
      ) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Token no valido.');
    }
  }

  private async findPublicRole(roleId: string | null) {
    if (!roleId) {
      return null;
    }

    return this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        permissions: true,
      },
    });
  }

  private async findPublicEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: {
        id: true,
        jobTitle: true,
        companyId: true,
        positionId: true,
        teamId: true,
      },
    });

    if (!employee) {
      return null;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: employee.companyId },
      select: { name: true },
    });
    const position = employee.positionId
      ? await this.prisma.jobPosition.findUnique({
          where: { id: employee.positionId },
          select: { name: true },
        })
      : null;
    const team = employee.teamId
      ? await this.prisma.workTeam.findUnique({
          where: { id: employee.teamId },
          select: { name: true },
        })
      : null;

    return {
      id: employee.id,
      jobTitle: employee.jobTitle,
      company: { name: company?.name ?? '' },
      position,
      team,
    };
  }

  private toPublicUser(user: {
    id: string;
    tenantId: string;
    roleId: string | null;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    status: string;
    themePreference: ThemePreference;
    sessionVersion?: number;
    role: { id: string; name: string; permissions: string[] } | null;
    employee: {
      id: string;
      jobTitle: string | null;
      company: { name: string };
      position: { name: string } | null;
      team: { name: string } | null;
    } | null;
  }) {
    const permissions = user.role?.permissions ?? [];
    const access = {
      admin: this.hasAdminAccess(permissions),
      portal: Boolean(user.employee),
    };

    return {
      id: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      themePreference: this.toPublicThemePreference(user.themePreference),
      role: user.role,
      permissions,
      employeeId: user.employee?.id ?? null,
      employee: user.employee
        ? {
            id: user.employee.id,
            jobTitle: user.employee.jobTitle,
            companyName: user.employee.company.name,
            positionName: user.employee.position?.name ?? null,
            teamName: user.employee.team?.name ?? null,
          }
        : null,
      access,
    };
  }

  private hasAdminAccess(permissions: string[]) {
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

  private getJwtSecret() {
    return getJwtSecret();
  }

  private toThemePreference(value: unknown) {
    if (value === 'light') return ThemePreference.LIGHT;
    if (value === 'dark') return ThemePreference.DARK;
    if (value === 'star') return ThemePreference.STAR;

    throw new BadRequestException('Tema visual no valido.');
  }

  private toPublicThemePreference(value: ThemePreference) {
    if (value === ThemePreference.DARK) return 'dark';
    if (value === ThemePreference.STAR) return 'star';
    return 'light';
  }

  private toOptionalString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const normalized = String(value).trim();

    return normalized.length > 0 ? normalized : null;
  }
}
