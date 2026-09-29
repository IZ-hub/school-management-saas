import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { QueryTimetableDto } from './dto/query-timetable.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Roles(...ADMIN_ROLES)
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() body: CreateTimetableDto) {
    const data = await this.timetableService.createTimetable(user.schoolId, body);
    return { data };
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query() query: QueryTimetableDto) {
    const data = await this.timetableService.listTimetables(user.schoolId, query);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: UpdateTimetableDto) {
    const data = await this.timetableService.updateTimetable(user.schoolId, id, body);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.timetableService.deleteTimetable(user.schoolId, id);
    return { data };
  }
}
