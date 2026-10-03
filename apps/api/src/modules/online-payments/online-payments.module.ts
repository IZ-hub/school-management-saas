import { Module } from '@nestjs/common';
import { OnlinePaymentsController, PaystackWebhookController } from './online-payments.controller';
import { OnlinePaymentsService } from './online-payments.service';
import { PaystackClient } from './paystack.client';
import { FeesModule } from '../fees/fees.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [FeesModule, PaymentsModule],
  controllers: [OnlinePaymentsController, PaystackWebhookController],
  providers: [OnlinePaymentsService, PaystackClient],
  exports: [OnlinePaymentsService],
})
export class OnlinePaymentsModule {}
