import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly service: ClassesService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateClassDto) {
    const data = await this.service.create(user.schoolId, dto);
    return { data };
  }

  @Get()
  async findAll(@CurrentUser() user: JwtPayload, @Query('name') name?: string) {
    const data = await this.service.findAll(user.schoolId, name);
    return { data };
  }

  @Post('bulk-import')
  async bulkImport(@CurrentUser() user: JwtPayload, @Body() body: { records: any[] }) {
    const data = await this.service.bulkCreate(user.schoolId, body.records);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.service.remove(id);
    return { data };
  }
}
