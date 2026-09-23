import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { ClassesModule } from '../classes/classes.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { ExamsModule } from '../exams/exams.module';
import { ResultsModule } from '../results/results.module';
import { FeesModule } from '../fees/fees.module';
import { PaymentsModule } from '../payments/payments.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    StudentsModule,
    TeachersModule,
    ClassesModule,
    SubjectsModule,
    ExamsModule,
    ResultsModule,
    FeesModule,
    PaymentsModule,
    AttendanceModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
