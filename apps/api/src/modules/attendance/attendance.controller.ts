import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAttendanceDto) {
    const data = await this.service.create(user.schoolId, user.sub, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    const query: Record<string, string> = {};
    if (studentId) query.studentId = studentId;
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (date) query.date = date;
    if (status) query.status = status;
    const data = await this.service.findAll(user.schoolId, query);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.service.remove(id);
    return { data };
  }
}
