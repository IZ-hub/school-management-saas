import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
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
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * Active students in each active class, with capacity, plus how many active
   * students have no class (or are still linked to a deleted class).
   */
  async classSizes(schoolId: string) {
    const [classSnap, studentSnap] = await Promise.all([
      this.firebase.firestore.collection('classes').where('schoolId', '==', schoolId).get(),
      this.firebase.firestore.collection('students').where('schoolId', '==', schoolId).get(),
    ]);
    const activeClasses = classSnap.docs.filter((d) => d.data().status !== 'INACTIVE');
    const counts = new Map<string, number>(activeClasses.map((d) => [d.id, 0]));
    let withoutClass = 0;
    let totalStudents = 0;
    for (const doc of studentSnap.docs) {
      const st = doc.data();
      if (st.status === 'INACTIVE') continue;
      totalStudents++;
      if (st.classId && counts.has(st.classId)) counts.set(st.classId, counts.get(st.classId)! + 1);
      else withoutClass++;
    }
    const classes = activeClasses
      .map((d) => ({
        id: d.id,
        name: String(d.data().name ?? ''),
        capacity: typeof d.data().capacity === 'number' && d.data().capacity > 0 ? d.data().capacity : null,
        students: counts.get(d.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return { classes, withoutClass, totalStudents };
  }

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
      attendanceToday,
      attendanceEverTaken,
      nextExam,
    ] = await Promise.all([
      this.students.count(schoolId),
      this.teachers.count(schoolId),
      this.classes.count(schoolId),
      this.subjects.count(schoolId),
      this.exams.count(schoolId),
      this.results.count(schoolId),
      this.fees.count(schoolId),
      this.payments.count(schoolId),
      this.attendance.today(schoolId),
      this.attendance.everTaken(schoolId),
      this.exams.upcoming(schoolId),
    ]);

    // Today's attendance (Lagos time); 0 until a register has been taken today.
    const attendanceRate = attendanceToday.rate ?? 0;

    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      attendanceRate,
      attendanceToday: {
        rate: attendanceToday.rate,
        classesTaken: attendanceToday.classesTaken,
        classesTotal: attendanceToday.classesTotal,
      },
      attendanceEverTaken,
      nextExam,
      totalExams,
      totalResults,
      totalFees,
      totalPayments,
    };
  }
}
