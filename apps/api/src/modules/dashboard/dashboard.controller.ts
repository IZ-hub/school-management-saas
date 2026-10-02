import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    const data = await this.service.getStats(user.schoolId);
    return { data };
  }

  /** Students per class, for the "Students by class" panel. */
  @Get('class-sizes')
  async getClassSizes(@CurrentUser() user: JwtPayload) {
    const data = await this.service.classSizes(user.schoolId);
    return { data };
  }
}
