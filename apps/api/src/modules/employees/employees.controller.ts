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
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { SelfUpdateAttendancePinDto } from './dto/self-update-attendance-pin.dto';
import type { TransferEmployeeDto } from './dto/transfer-employee.dto';
import type { UpdateAttendancePinDto } from './dto/update-attendance-pin.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get(['trabajadores', 'employees'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('cursor') cursor?: string,
    @Query('pagination') pagination?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.employeesService.findAll(user, {
      companyId: scopedCompanyId(user, companyId) ?? undefined,
      cursor,
      cursorMode: pagination === 'cursor',
      page,
      pageSize,
      search,
      status,
    });
  }

  @Get(['trabajadores/codigo-sugerido', 'employees/suggested-code'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.view')
  getSuggestedCode(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.employeesService.previewEmployeeCode(
      user.tenantId,
      scopedCompanyId(user, companyId) ?? undefined,
    );
  }

  @Get(['trabajadores/:id/perfil', 'employees/:id/profile'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.view')
  getProfile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employeesService.getProfile(user, id);
  }

  @Post(['trabajadores', 'employees'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.manage')
  create(
    @CurrentUser() user: AuthUser,
    @Body() createEmployeeDto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(user, createEmployeeDto);
  }

  @Post([
    'trabajadores/actualizar-pin-marcacion',
    'employees/self-attendance-pin',
  ])
  selfUpdateAttendancePin(
    @Body() selfUpdateAttendancePinDto: SelfUpdateAttendancePinDto,
  ) {
    return this.employeesService.selfUpdateAttendancePin(
      selfUpdateAttendancePinDto,
    );
  }

  @Patch(['trabajadores/:id/pin-marcacion', 'employees/:id/attendance-pin'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.manage')
  updateAttendancePin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateAttendancePinDto: UpdateAttendancePinDto,
  ) {
    return this.employeesService.updateAttendancePin(
      user,
      id,
      updateAttendancePinDto,
    );
  }

  @Post(['trabajadores/:id/transferir', 'employees/:id/transfer'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.manage')
  transfer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() transferEmployeeDto: TransferEmployeeDto,
  ) {
    return this.employeesService.transfer(user, id, transferEmployeeDto);
  }

  @Patch(['trabajadores/:id', 'employees/:id'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user, id, updateEmployeeDto);
  }

  @Delete(['trabajadores/:id', 'employees/:id'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('employees.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employeesService.remove(user, id);
  }
}
