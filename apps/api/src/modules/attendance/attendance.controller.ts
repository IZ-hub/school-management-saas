import { Body, Controller, Get, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SaveRegisterDto } from './dto/save-register.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ACADEMIC_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ACADEMIC_ROLES)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  /** Which classes have taken the register today (or ?date=YYYY-MM-DD). */
  @Get('today')
  async today(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    const data = await this.service.today(user.schoolId, date || undefined, user);
    return { data };
  }

  /** The register for one class on one date. */
  @Get('register')
  async getRegister(@CurrentUser() user: JwtPayload, @Query('classId') classId: string, @Query('date') date: string) {
    const data = await this.service.getRegister(user.schoolId, classId ?? '', date ?? '', user);
    return { data };
  }

  /** Save (create or update) a class register. */
  @Put('register')
  async saveRegister(@CurrentUser() user: JwtPayload, @Body() dto: SaveRegisterDto) {
    const data = await this.service.saveRegister(user.schoolId, user, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    const query: Record<string, string> = {};
    if (studentId) query.studentId = studentId;
    if (classId) query.classId = classId;
    if (date) query.date = date;
    if (status) query.status = status;
    const data = await this.service.findAll(user.schoolId, query, user);
    return { data };
  }

  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    const data = await this.service.update(user.schoolId, id, dto, user);
    return { data };
  }
}
