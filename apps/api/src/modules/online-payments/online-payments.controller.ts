import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OnlinePaymentsService } from './online-payments.service';
import { SavePaystackKeyDto, StartPaymentDto, VerifyPaymentDto } from './dto/online-payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, FINANCE_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

/** School admins connect their own Paystack account; parents pay through it. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OnlinePaymentsController {
  constructor(private readonly service: OnlinePaymentsService) {}

  @Roles(...ADMIN_ROLES)
  @Get('online-payments/settings')
  async settings(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.settings(user.schoolId) };
  }

  @Roles(...ADMIN_ROLES)
  @Put('online-payments/settings')
  async saveKey(@CurrentUser() user: JwtPayload, @Body() dto: SavePaystackKeyDto) {
    return { data: await this.service.saveKey(user.schoolId, user.sub, dto.secretKey) };
  }

  @Roles(...ADMIN_ROLES)
  @Delete('online-payments/settings')
  async removeKey(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.removeKey(user.schoolId) };
  }

  @Roles(...FINANCE_ROLES)
  @Get('online-payments')
  async list(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.list(user.schoolId) };
  }

  @Roles('PARENT')
  @Post('parent/children/:id/pay')
  async start(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: StartPaymentDto, @Headers('origin') origin?: string) {
    return { data: await this.service.start(user, id, dto.amount, origin) };
  }

  @Roles('PARENT')
  @Post('parent/payments/verify')
  async verify(@CurrentUser() user: JwtPayload, @Body() dto: VerifyPaymentDto) {
    return { data: await this.service.verifyForParent(user, dto.reference) };
  }
}

/** Public: Paystack calls this. The signature is checked against the school's own secret key. */
@Controller('paystack')
export class PaystackWebhookController {
  constructor(private readonly service: OnlinePaymentsService) {}

  @Post('webhook/:schoolId')
  @HttpCode(200)
  async webhook(@Param('schoolId') schoolId: string, @Req() req: Request & { rawBody?: Buffer }, @Headers('x-paystack-signature') signature?: string) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.service.webhook(schoolId, raw, signature, req.body);
  }
}
