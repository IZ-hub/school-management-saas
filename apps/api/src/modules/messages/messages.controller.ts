import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ComposeDto, SmsSettingsDto } from './dto/messages.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

const SENDERS = [...ADMIN_ROLES, 'ACCOUNTANT'];

/** Messages from the school to parents: on the parent's page, and by SMS through the school's own Termii account. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Roles(...ADMIN_ROLES)
  @Get('messages/sms-settings')
  async smsSettings(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.smsSettings(user.schoolId) };
  }

  @Roles(...ADMIN_ROLES)
  @Put('messages/sms-settings')
  async saveSmsSettings(@CurrentUser() user: JwtPayload, @Body() dto: SmsSettingsDto) {
    return { data: await this.service.saveSmsSettings(user.schoolId, user.sub, dto.apiKey, dto.senderId) };
  }

  @Roles(...ADMIN_ROLES)
  @Delete('messages/sms-settings')
  async removeSmsSettings(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.removeSmsSettings(user.schoolId) };
  }

  @Roles(...SENDERS)
  @Post('messages/preview')
  async preview(@CurrentUser() user: JwtPayload, @Body() dto: ComposeDto) {
    return { data: await this.service.preview(user.schoolId, user, dto) };
  }

  @Roles(...SENDERS)
  @Post('messages')
  async send(@CurrentUser() user: JwtPayload, @Body() dto: ComposeDto) {
    return { data: await this.service.send(user.schoolId, user, dto) };
  }

  @Roles(...SENDERS)
  @Get('messages')
  async history(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.history(user.schoolId) };
  }

  @Roles(...SENDERS)
  @Get('messages/:id/problems')
  async problems(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return { data: await this.service.problems(user.schoolId, id) };
  }

  @Roles('PARENT')
  @Get('parent/messages')
  async inbox(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.inbox(user) };
  }
}
