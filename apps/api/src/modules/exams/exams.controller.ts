import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { UpdatePaperDto } from './dto/update-paper.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ACADEMIC_ROLES, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** Individual exam papers (one class + subject within an exam series). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ACADEMIC_ROLES)
@Controller('exams')
export class ExamsController {
  constructor(private readonly service: ExamsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('seriesId') seriesId?: string,
  ) {
    const query: Record<string, string> = {};
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (seriesId) query.seriesId = seriesId;
    const data = await this.service.findAll(user.schoolId, query);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdatePaperDto) {
    const data = await this.service.updatePaper(user.schoolId, id, dto);
    return { data };
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.deletePaper(user.schoolId, id);
    return { data };
  }
}
