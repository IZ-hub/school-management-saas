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
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateTimetableDto) {
    const data = await this.timetableService.updateTimetable(id, body);
    return { data };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const data = await this.timetableService.deleteTimetable(id);
    return { data };
  }
}
