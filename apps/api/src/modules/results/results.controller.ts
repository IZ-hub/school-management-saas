import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { CreateResultDto } from './dto/create-result.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateResultDto) {
    const data = await this.service.create(user.schoolId, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('examId') examId?: string,
    @Query('studentId') studentId?: string,
  ) {
    const query: Record<string, string> = {};
    if (examId) query.examId = examId;
    if (studentId) query.studentId = studentId;
    const data = await this.service.findAll(user.schoolId, query);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateResultDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.service.remove(id);
    return { data };
  }
}
