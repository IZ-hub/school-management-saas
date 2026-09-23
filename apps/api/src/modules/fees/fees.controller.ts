import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { FeesService } from './fees.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('fees')
export class FeesController {
  constructor(private readonly service: FeesService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFeeDto) {
    const data = await this.service.create(user.schoolId, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('term') term?: string,
    @Query('status') status?: string,
  ) {
    const query: Record<string, string> = {};
    if (studentId) query.studentId = studentId;
    if (classId) query.classId = classId;
    if (term) query.term = term;
    if (status) query.status = status;
    const data = await this.service.findAll(user.schoolId, query);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateFeeDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.service.remove(id);
    return { data };
  }
}
