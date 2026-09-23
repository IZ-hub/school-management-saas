import { Injectable } from '@nestjs/common';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';
import { ClassesService } from '../classes/classes.service';
import { SubjectsService } from '../subjects/subjects.service';
import { ExamsService } from '../exams/exams.service';
import { ResultsService } from '../results/results.service';
import { FeesService } from '../fees/fees.service';
import { PaymentsService } from '../payments/payments.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly students: StudentsService,
    private readonly teachers: TeachersService,
    private readonly classes: ClassesService,
    private readonly subjects: SubjectsService,
    private readonly exams: ExamsService,
    private readonly results: ResultsService,
    private readonly fees: FeesService,
    private readonly payments: PaymentsService,
    private readonly attendance: AttendanceService,
  ) {}

  async getStats(schoolId: string) {
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      totalExams,
      totalResults,
      totalFees,
      totalPayments,
      attendancePresent,
      attendanceTotal,
    ] = await Promise.all([
      this.students.count(schoolId),
      this.teachers.count(schoolId),
      this.classes.count(schoolId),
      this.subjects.count(schoolId),
      this.exams.count(schoolId),
      this.results.count(schoolId),
      this.fees.count(schoolId),
      this.payments.count(schoolId),
      this.attendance.countPresent(schoolId),
      this.attendance.countTotal(schoolId),
    ]);

    const attendanceRate =
      attendanceTotal > 0
        ? Math.round((attendancePresent / attendanceTotal) * 100)
        : 0;

    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      attendanceRate,
      totalExams,
      totalResults,
      totalFees,
      totalPayments,
    };
  }
}
