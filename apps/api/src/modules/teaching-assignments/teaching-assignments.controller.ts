import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TeachingAssignmentsService } from './teaching-assignments.service';
import { CreateTeachingAssignmentDto } from './dto/create-teaching-assignment.dto';
import { UpdateTeachingAssignmentDto } from './dto/update-teaching-assignment.dto';
import { QueryTeachingAssignmentDto } from './dto/query-teaching-assignment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** Which subjects each class takes, and who teaches each one. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('teaching-assignments')
export class TeachingAssignmentsController {
  constructor(private readonly service: TeachingAssignmentsService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query() query: QueryTeachingAssignmentDto) {
    const data = await this.service.list(user.schoolId, query);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeachingAssignmentDto) {
    const data = await this.service.create(user.schoolId, dto);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Post('bulk-import')
  async bulkImport(@CurrentUser() user: JwtPayload, @Body() body: { records: any[] }) {
    const data = await this.service.bulkCreate(user.schoolId, body.records ?? []);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateTeachingAssignmentDto) {
    const data = await this.service.update(user.schoolId, id, dto);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.remove(user.schoolId, id);
    return { data };
  }
}
