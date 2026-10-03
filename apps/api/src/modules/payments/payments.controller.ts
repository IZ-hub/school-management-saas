import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto, VoidPaymentDto } from './dto/payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, FINANCE_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...FINANCE_ROLES)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query('term') term?: string, @Query('session') session?: string, @Query('studentId') studentId?: string) {
    const data = await this.service.list(user.schoolId, { term, session, studentId });
    return { data };
  }

  @Get(':id')
  async receipt(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.receipt(user.schoolId, id);
    return { data };
  }

  @Post()
  async record(@CurrentUser() user: JwtPayload, @Body() dto: RecordPaymentDto) {
    const data = await this.service.record(user.schoolId, user, dto);
    return { data };
  }

  @Post(':id/void')
  async void(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: VoidPaymentDto) {
    const data = await this.service.void(user.schoolId, user, id, dto);
    return { data };
  }
}
