import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard, RolesGuard],
  exports: [JwtAuthGuard, PermissionsGuard, RolesGuard],
})
export class AuthModule {}
