import { Body, Controller, Get, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ADMIN_ROLES, STAFF_ROLES } from '../../common/roles';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class VerifyDto {
  @IsNotEmpty() @IsString() @MaxLength(100) reference: string;
}

/** The school's SchoolBricks subscription: ₦1,500 per active student per term. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  /** For the banner every staff member sees. */
  @Roles(...STAFF_ROLES)
  @Get('status')
  async status(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.status(user.schoolId) };
  }

  @Roles(...ADMIN_ROLES)
  @Get()
  async overview(@CurrentUser() user: JwtPayload) {
    return { data: await this.service.overview(user.schoolId) };
  }

  @Roles(...ADMIN_ROLES)
  @Post('pay')
  async pay(@CurrentUser() user: JwtPayload, @Headers('origin') origin?: string) {
    return { data: await this.service.pay(user.schoolId, user, origin) };
  }

  @Roles(...ADMIN_ROLES)
  @Post('verify')
  async verify(@CurrentUser() user: JwtPayload, @Body() dto: VerifyDto) {
    return { data: await this.service.verify(user.schoolId, dto.reference) };
  }
}

/** Public: Paystack calls this for subscription payments (signed with the SchoolBricks key). */
@Controller('billing-webhook')
export class BillingWebhookController {
  constructor(private readonly service: BillingService) {}

  @Post('paystack')
  @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-paystack-signature') signature?: string) {
    return this.service.webhook(req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})), signature, req.body);
  }
}
