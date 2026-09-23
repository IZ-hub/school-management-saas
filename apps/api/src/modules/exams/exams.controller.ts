import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamsController {
  constructor(private readonly service: ExamsService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamDto) {
    const data = await this.service.create(user.schoolId, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('title') title?: string,
  ) {
    const query: Record<string, string> = {};
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (title) query.title = title;
    const data = await this.service.findAll(user.schoolId, query);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExamDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.service.remove(id);
    return { data };
  }
}
