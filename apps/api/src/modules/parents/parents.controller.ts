import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { InviteParentDto } from './dto/invite-parent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** School admins give and remove parent access. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('parent-access')
export class ParentAccessController {
  constructor(private readonly service: ParentsService) {}

  @Get()
  async forStudent(@CurrentUser() user: JwtPayload, @Query('studentId') studentId = '') {
    return { data: await this.service.forStudent(user.schoolId, studentId) };
  }

  @Post('invite')
  async invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteParentDto) {
    return { data: await this.service.invite(user.schoolId, user, dto) };
  }

  @Post(':userId/resend')
  async resend(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return { data: await this.service.resendInvite(user.schoolId, user, userId) };
  }

  @Delete(':userId/children/:studentId')
  async unlink(@CurrentUser() user: JwtPayload, @Param('userId') userId: string, @Param('studentId') studentId: string) {
    return { data: await this.service.unlink(user.schoolId, userId, studentId) };
  }
}

/** What a signed-in parent can see: only their own children. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PARENT')
@Controller('parent')
export class ParentPortalController {
  constructor(private readonly service: ParentsService) {}

  @Get('children')
  async children(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.children(user) };
  }

  @Get('children/:id')
  async overview(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.overview(user, id) };
  }

  @Get('children/:id/report-card')
  async reportCard(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query('seriesId') seriesId = '') {
    return { data: await this.service.reportCard(user, id, seriesId) };
  }

  @Get('children/:id/fees')
  async fees(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query('term') term?: string, @Query('session') session?: string) {
    return { data: await this.service.feeStatement(user, id, term, session) };
  }
}
