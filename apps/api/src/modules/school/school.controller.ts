import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SaveTermsDto, UpdateSchoolDto } from './dto/school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** The school's own details, logo and term dates. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('school')
export class SchoolController {
  constructor(private readonly service: SchoolService) {}

  @Get()
  async get(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.get(user.schoolId) };
  }

  @Roles(...ADMIN_ROLES)
  @Patch()
  async update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateSchoolDto) {
    return { data: await this.service.update(user.schoolId, dto) };
  }

  @Roles(...ADMIN_ROLES)
  @Put('terms')
  async saveTerms(@CurrentUser() user: JwtPayload, @Body() dto: SaveTermsDto) {
    return { data: await this.service.saveTerms(user.schoolId, dto) };
  }
}
