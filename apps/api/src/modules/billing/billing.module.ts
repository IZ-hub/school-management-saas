import { Module } from '@nestjs/common';
import { BillingController, BillingWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { OnlinePaymentsModule } from '../online-payments/online-payments.module';

@Module({
  imports: [OnlinePaymentsModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService],
})
export class BillingModule {}
