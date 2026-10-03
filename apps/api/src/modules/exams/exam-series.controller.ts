import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { AddPapersDto, CreateExamSeriesDto, PublishResultsDto, UpdateExamSeriesDto } from './dto/exam-series.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ACADEMIC_ROLES, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** An exam series, e.g. "First Term Examination 2026/2027", with its papers and timetable. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ACADEMIC_ROLES)
@Controller('exam-series')
export class ExamSeriesController {
  constructor(private readonly service: ExamsService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    const data = await this.service.listSeries(user.schoolId);
    return { data };
  }

  @Get(':id')
  async get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.getSeries(user.schoolId, id);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamSeriesDto) {
    const data = await this.service.createSeries(user.schoolId, dto);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateExamSeriesDto) {
    const data = await this.service.updateSeries(user.schoolId, id, dto);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/papers')
  async addPapers(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddPapersDto) {
    const data = await this.service.addPapers(user.schoolId, id, dto);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/schedule-import')
  async importSchedule(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { records: any[] }) {
    const data = await this.service.importSchedule(user.schoolId, id, body.records ?? []);
    return { data };
  }

  /** Makes this exam's report cards visible to parents (or hides them again). */
  @Roles(...ADMIN_ROLES)
  @Patch(':id/publish')
  async publish(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: PublishResultsDto) {
    const data = await this.service.setPublished(user.schoolId, id, dto.published);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.deleteSeries(user.schoolId, id);
    return { data };
  }
}
