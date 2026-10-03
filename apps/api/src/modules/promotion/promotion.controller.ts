import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { ApplyPromotionDto } from './dto/promotion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** End-of-session promotion: everyone moves up a class, the final year graduates. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('promotion')
export class PromotionController {
  constructor(private readonly service: PromotionService) {}

  @Get('plan')
  async plan(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.plan(user.schoolId) };
  }

  @Post('apply')
  async apply(@CurrentUser() user: JwtPayload, @Body() dto: ApplyPromotionDto) {
    return { data: await this.service.apply(user.schoolId, user, dto) };
  }

  @Post(':id/undo')
  async undo(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.undo(user.schoolId, user, id) };
  }
}
