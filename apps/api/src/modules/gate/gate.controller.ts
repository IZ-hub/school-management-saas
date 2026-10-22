import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { GateService, ScanMode } from './gate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ACADEMIC_ROLES, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class ScanDto {
  @IsNotEmpty() @IsString() @MaxLength(64) code: string;
  @IsOptional() @IsIn(['AUTO', 'IN', 'OUT']) mode?: ScanMode;
}

class GateSettingsDto {
  /** HH:MM, or null to stop marking late arrivals. */
  @ValidateIf((o) => o.lateAfter !== null) @IsString() lateAfter: string | null;
}

/** Clocking students in and out at the school gate with their ID cards. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ACADEMIC_ROLES)
@Controller('gate')
export class GateController {
  constructor(private readonly service: GateService) {}

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
    return { data: await this.service.saveSettings(user.schoolId, dto.lateAfter ?? null) };
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
}
