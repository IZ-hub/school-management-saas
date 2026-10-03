import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { ChangeRoleDto, InviteStaffDto, LinkTeacherDto } from './dto/staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** Staff sign-in accounts: invite, change role, switch off. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('staff')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.list(user.schoolId) };
  }

  @Post('invite')
  async invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteStaffDto) {
    return { data: await this.service.invite(user.schoolId, user, dto) };
  }

  @Post(':id/resend')
  async resend(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.resend(user.schoolId, user, id) };
  }

  @Patch(':id/role')
  async changeRole(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return { data: await this.service.changeRole(user.schoolId, user, id, dto) };
  }

  @Patch(':id/teacher')
  async linkTeacher(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: LinkTeacherDto) {
    return { data: await this.service.linkTeacher(user.schoolId, user, id, dto) };
  }

  @Post(':id/disable')
  async disable(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.setEnabled(user.schoolId, user, id, false) };
  }

  @Post(':id/enable')
  async enable(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.setEnabled(user.schoolId, user, id, true) };
  }
}
