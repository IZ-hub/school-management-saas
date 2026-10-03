import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { SetSlotDto, TimetableSetupDto } from './dto/timetable.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** Weekly class timetables. Staff can view; admins build them. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('timetable')
export class TimetableController {
  constructor(private readonly service: TimetableService) {}

  @Get('setup')
  async setup(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.setup(user.schoolId) };
  }

  @Roles(...ADMIN_ROLES)
  @Put('setup')
  async saveSetup(@CurrentUser() user: JwtPayload, @Body() dto: TimetableSetupDto) {
    return { data: await this.service.saveSetup(user.schoolId, dto) };
  }

  @Get('overview')
  async overview(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.overview(user.schoolId) };
  }

  @Get('mine')
  async mine(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.mine(user) };
  }

  @Get('class/:id')
  async forClass(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.forClass(user.schoolId, id) };
  }

  @Get('teacher/:id')
  async forTeacher(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.forTeacher(user.schoolId, id) };
  }

  @Roles(...ADMIN_ROLES)
  @Put('class/:id/slot')
  async setSlot(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: SetSlotDto) {
    return { data: await this.service.setSlot(user.schoolId, id, dto) };
  }
}
