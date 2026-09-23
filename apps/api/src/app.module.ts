import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { ClassesModule } from './modules/classes/classes.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ResultsModule } from './modules/results/results.module';
import { FeesModule } from './modules/fees/fees.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TimetableModule } from './modules/timetable/timetable.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    AuthModule,
    StudentsModule,
    TeachersModule,
    ClassesModule,
    SubjectsModule,
    AttendanceModule,
    ExamsModule,
    ResultsModule,
    FeesModule,
    PaymentsModule,
    DashboardModule,
    TimetableModule,
  ],
})
export class AppModule {}
