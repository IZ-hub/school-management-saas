import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { FeesService } from './fees.service';
import { SaveDiscountDto, SaveScheduleDto } from './dto/fees.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, FINANCE_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...FINANCE_ROLES)
@Controller('fees')
export class FeesController {
  constructor(private readonly service: FeesService) {}

  /** Expected, collected and outstanding for a term (the current term by default). */
  @Get('overview')
  async overview(@CurrentUser() user: JwtPayload, @Query('term') term?: string, @Query('session') session?: string) {
    const data = await this.service.overview(user.schoolId, term, session);
    return { data };
  }

  @Get('statement/:studentId')
  async statement(@CurrentUser() user: JwtPayload, @Param('studentId') studentId: string, @Query('term') term?: string, @Query('session') session?: string) {
    const data = await this.service.statement(user.schoolId, studentId, term, session);
    return { data };
  }

  @Post('schedules')
  async saveSchedule(@CurrentUser() user: JwtPayload, @Body() dto: SaveScheduleDto) {
    const data = await this.service.saveSchedule(user.schoolId, user.sub, dto);
    return { data };
  }

  @Delete('schedules/:id')
  async deleteSchedule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.service.deleteSchedule(user.schoolId, id);
    return { data };
  }

  @Put('discounts')
  async saveDiscount(@CurrentUser() user: JwtPayload, @Body() dto: SaveDiscountDto) {
    const data = await this.service.saveDiscount(user.schoolId, user.sub, dto);
    return { data };
  }
}
