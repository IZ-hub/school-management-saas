import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, PAYROLL_ROLES, STAFF_ROLES } from '../../common/roles';

/** Salaries are only for those who handle pay. */
const seesPay = (user: JwtPayload) => PAYROLL_ROLES.includes(user.role);
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Roles(...ADMIN_ROLES)
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeacherDto) {
    const data = await this.service.create(user.schoolId, dto, seesPay(user));
    return { data };
  }

  @Get()
  async findAll(@CurrentUser() user: JwtPayload, @Query('search') search?: string) {
    const data = await this.service.findAll(user.schoolId, search, seesPay(user));
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Post('bulk-import')
  async bulkImport(@CurrentUser() user: JwtPayload, @Body() body: { records: any[] }) {
    const data = await this.service.bulkCreate(user.schoolId, body.records, seesPay(user));
    return { data };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.findOne(user.schoolId, id, seesPay(user));
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    const data = await this.service.update(user.schoolId, id, dto, seesPay(user));
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.remove(user.schoolId, id);
    return { data };
  }
}
