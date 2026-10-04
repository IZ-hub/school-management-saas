import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('students')
export class StudentProfileController {
  constructor(private readonly service: StudentProfileService) {}

  /** One student's details, class, attendance, results, fees, parents and messages, as the caller's role allows. */
  @Get(':id/profile')
  async profile(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.profile(user.schoolId, user, id) };
  }
}
