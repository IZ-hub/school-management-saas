import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';
import { ClassesService } from '../classes/classes.service';
import { SubjectsService } from '../subjects/subjects.service';
import { ExamsService } from '../exams/exams.service';
import { ResultsService } from '../results/results.service';
import { FeesService } from '../fees/fees.service';
import { AttendanceService } from '../attendance/attendance.service';
import { countOf } from '../../common/aggregate';

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
    private readonly attendance: AttendanceService,
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * Active students in each active class, with capacity, plus how many active
   * students have no class (or are still linked to a deleted class).
   */
  async classSizes(schoolId: string) {
    const db = this.firebase.firestore;
    const activeStudents = db.collection('students').where('schoolId', '==', schoolId).where('status', '==', 'ACTIVE');
    const classSnap = await db.collection('classes').where('schoolId', '==', schoolId).get();
    const activeClasses = classSnap.docs.filter((d) => d.data().status !== 'INACTIVE');
    // Counted on the database side: one read per class instead of one per student.
    const [totalStudents, sizes] = await Promise.all([
      countOf(activeStudents),
      Promise.all(activeClasses.map((d) => countOf(activeStudents.where('classId', '==', d.id)))),
    ]);
    const classes = activeClasses
      .map((d, i) => ({
        id: d.id,
        name: String(d.data().name ?? ''),
        capacity: typeof d.data().capacity === 'number' && d.data().capacity > 0 ? d.data().capacity : null,
        students: sizes[i],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const withoutClass = Math.max(0, totalStudents - sizes.reduce((x, y) => x + y, 0));
    return { classes, withoutClass, totalStudents };
  }

  /** Finance figures are only included for roles that can see fees. */
  async getStats(schoolId: string, canSeeFees = true) {
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      totalExams,
      totalResults,
      feesTerm,
      attendanceToday,
      attendanceEverTaken,
      nextExam,
      attendanceTrend,
    ] = await Promise.all([
      this.students.count(schoolId),
      this.teachers.count(schoolId),
      this.classes.count(schoolId),
      this.subjects.count(schoolId),
      this.exams.count(schoolId),
      this.results.count(schoolId),
      canSeeFees ? this.fees.termSummary(schoolId) : Promise.resolve(null),
      this.attendance.today(schoolId),
      this.attendance.everTaken(schoolId),
      this.exams.upcoming(schoolId),
      this.attendance.trend(schoolId),
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
      attendanceTrend,
      totalExams,
      totalResults,
      feesTerm,
    };
  }
}
