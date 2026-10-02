import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ReportCardsService } from './report-cards.service';
import { SaveRemarksDto } from './dto/save-remarks.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ACADEMIC_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ACADEMIC_ROLES)
@Controller('report-cards')
export class ReportCardsController {
  constructor(private readonly service: ReportCardsService) {}

  @Get()
  async forClass(@CurrentUser() user: JwtPayload, @Query('seriesId') seriesId = '', @Query('classId') classId = '') {
    const data = await this.service.forClass(user.schoolId, seriesId, classId);
    return { data };
  }

  @Put('remarks')
  async saveRemarks(@CurrentUser() user: JwtPayload, @Body() dto: SaveRemarksDto) {
    const data = await this.service.saveRemarks(user.schoolId, user, dto);
    return { data };
  }
}
