import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamSeriesController } from './exam-series.controller';

@Module({
  controllers: [ExamsController, ExamSeriesController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
