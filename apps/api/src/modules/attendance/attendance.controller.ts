import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { scopedCompanyId } from '../auth/access-scope';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AttendanceService } from './attendance.service';
import type { MarkAttendanceDto } from './dto/mark-attendance.dto';
import type { SelfMarkAttendanceDto } from './dto/self-mark-attendance.dto';

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get(['asistencia/resumen', 'attendance/summary'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('attendance.view')
  getSummary(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.attendanceService.getSummary(
      user,
      date,
      scopedCompanyId(user, companyId) ?? undefined,
    );
  }

  @Get(['asistencia/hoy', 'attendance/today'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('attendance.view')
  getToday(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.attendanceService.getToday(
      user,
      date,
      scopedCompanyId(user, companyId) ?? undefined,
    );
  }

  @Get(['asistencia/rango', 'attendance/range'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('attendance.view')
  getRange(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.attendanceService.getRange(
      user,
      from,
      to,
      scopedCompanyId(user, companyId) ?? undefined,
    );
  }

  @Post(['asistencia/marcar', 'attendance/mark'])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('attendance.manage')
  mark(
    @CurrentUser() user: AuthUser,
    @Body() markAttendanceDto: MarkAttendanceDto,
  ) {
    return this.attendanceService.mark(user, markAttendanceDto);
  }

  @Post(['asistencia/marcacion-personal', 'attendance/self-mark'])
  selfMark(@Body() selfMarkAttendanceDto: SelfMarkAttendanceDto) {
    return this.attendanceService.selfMark(selfMarkAttendanceDto);
  }
}
