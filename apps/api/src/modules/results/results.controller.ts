import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ResultsService } from './results.service';
import { SaveSheetDto } from './dto/save-sheet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ACADEMIC_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ACADEMIC_ROLES)
@Controller('results')
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Get()
  async findAll(@CurrentUser() user: JwtPayload, @Query('examId') examId?: string, @Query('studentId') studentId?: string) {
    const query: Record<string, string> = {};
    if (examId) query.examId = examId;
    if (studentId) query.studentId = studentId;
    const data = await this.service.findAll(user.schoolId, query, user);
    return { data };
  }

  /** Scoring progress for each paper in an exam series. */
  @Get('progress')
  async progress(@CurrentUser() user: JwtPayload, @Query('seriesId') seriesId = '') {
    const data = await this.service.progress(user.schoolId, seriesId, user);
    return { data };
  }

  /** The score sheet for one paper (class + subject). */
  @Get('sheet')
  async getSheet(@CurrentUser() user: JwtPayload, @Query('examId') examId = '') {
    const data = await this.service.getSheet(user.schoolId, examId, user);
    return { data };
  }

  @Put('sheet')
  async saveSheet(@CurrentUser() user: JwtPayload, @Body() dto: SaveSheetDto) {
    const data = await this.service.saveSheet(user.schoolId, user, dto);
    return { data };
  }
}
