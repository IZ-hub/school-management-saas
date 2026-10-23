import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { GateService, ScanMode } from './gate.service';
import { StaffClockService } from './staff-clock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ACADEMIC_ROLES, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { schoolToday } from '../../common/school-date';

class ScanDto {
  @IsNotEmpty() @IsString() @MaxLength(64) code: string;
  @IsOptional() @IsIn(['AUTO', 'IN', 'OUT']) mode?: ScanMode;
}

class GateSettingsDto {
  /** HH:MM, or null to stop marking late arrivals. Leave a field out to keep it as it is. */
  @IsOptional() @ValidateIf((o) => o.lateAfter !== null) @IsString() lateAfter?: string | null;
  @IsOptional() @ValidateIf((o) => o.staffLateAfter !== null) @IsString() staffLateAfter?: string | null;
}

/** Clocking students in and out at the school gate with their ID cards. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ACADEMIC_ROLES)
@Controller('gate')
export class GateController {
  constructor(private readonly service: GateService, private readonly staff: StaffClockService) {}

  /** Any teacher or admin on gate duty can scan any student of the school. */
  @Post('scan')
  async scan(@CurrentUser() user: JwtPayload, @Body() dto: ScanDto) {
    return { data: await this.service.scan(user.schoolId, user, dto.code, dto.mode ?? 'AUTO') };
  }

  @Get('today')
  async today(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.today(user.schoolId) };
  }

  @Get('settings')
  async settings(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.settings(user.schoolId) };
  }

  @Put('settings')
  @Roles(...ADMIN_ROLES)
  async saveSettings(@CurrentUser() user: JwtPayload, @Body() dto: GateSettingsDto) {
    return { data: await this.service.saveSettings(user.schoolId, { lateAfter: dto.lateAfter, staffLateAfter: dto.staffLateAfter }) };
  }

  /** ID card details for a class (?classId=) or the whole school. */
  @Get('cards')
  @Roles(...ADMIN_ROLES)
  async cards(@CurrentUser() user: JwtPayload, @Query('classId') classId?: string) {
    return { data: await this.service.cards(user.schoolId, classId || undefined) };
  }

  @Post('cards/:studentId/reissue')
  @Roles(...ADMIN_ROLES)
  async reissue(@CurrentUser() user: JwtPayload, @Param('studentId') studentId: string) {
    return { data: await this.service.reissue(user.schoolId, studentId) };
  }

  /** ID cards for every staff member: teachers, and staff accounts that aren't a teacher's. */
  @Get('staff-cards')
  @Roles(...ADMIN_ROLES)
  async staffCards(@CurrentUser() user: JwtPayload) {
    return { data: await this.staff.cards(user.schoolId) };
  }

  @Post('staff-cards/:key/reissue')
  @Roles(...ADMIN_ROLES)
  async reissueStaff(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    return { data: await this.staff.reissue(user.schoolId, key) };
  }

  /** Who came in, when, and who was late, for a day (?date=YYYY-MM-DD, default today). */
  @Get('staff-attendance')
  @Roles(...ADMIN_ROLES)
  async staffAttendance(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    return { data: await this.staff.day(user.schoolId, date || schoolToday()) };
  }
}
