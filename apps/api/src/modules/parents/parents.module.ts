import { Module } from '@nestjs/common';
import { ParentAccessController, ParentPortalController } from './parents.controller';
import { ParentsService } from './parents.service';
import { FeesModule } from '../fees/fees.module';
import { ReportCardsModule } from '../report-cards/report-cards.module';

@Module({
  imports: [FeesModule, ReportCardsModule],
  controllers: [ParentAccessController, ParentPortalController],
  providers: [ParentsService],
})
export class ParentsModule {}
