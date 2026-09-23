import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePaymentDto) {
    const data = await this.service.create(user.schoolId, dto);
    return { data };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('feeId') feeId?: string,
    @Query('studentId') studentId?: string,
    @Query('method') method?: string,
  ) {
    const query: Record<string, string> = {};
    if (feeId) query.feeId = feeId;
    if (studentId) query.studentId = studentId;
    if (method) query.method = method;
    const data = await this.service.findAll(user.schoolId, query);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    const data = await this.service.update(id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.service.remove(id);
    return { data };
  }
}
