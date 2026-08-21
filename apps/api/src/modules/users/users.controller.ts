import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { scopedCompanyId } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('users.manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(['usuarios', 'users'])
  findUsers(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('roleId') roleId?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.findUsers(user.tenantId, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      page,
      pageSize,
      roleId,
      search,
      status,
    });
  }

  @Get(['usuarios/roles', 'users/roles'])
  findRoles(@CurrentUser() user: AuthUser) {
    return this.usersService.findRoles(user.tenantId);
  }

  @Post(['usuarios/roles', 'users/roles'])
  createRole(
    @CurrentUser() user: AuthUser,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    return this.usersService.createRole(user, createRoleDto);
  }

  @Patch(['usuarios/roles/:id', 'users/roles/:id'])
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(user, id, updateRoleDto);
  }

  @Delete(['usuarios/roles/:id', 'users/roles/:id'])
  deleteRole(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.deleteRole(user, id);
  }

  @Post(['usuarios', 'users'])
  createUser(
    @CurrentUser() user: AuthUser,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.createUser(user, createUserDto);
  }

  @Patch(['usuarios/:id', 'users/:id'])
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user, id, updateUserDto);
  }

  @Delete(['usuarios/:id', 'users/:id'])
  deleteUser(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.deleteUser(user, id);
  }
}
