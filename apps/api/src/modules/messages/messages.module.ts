import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { TermiiClient } from './termii.client';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [FeesModule],
  controllers: [MessagesController],
  providers: [MessagesService, TermiiClient],
})
export class MessagesModule {}
