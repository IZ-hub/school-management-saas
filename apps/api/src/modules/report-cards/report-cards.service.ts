import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { ADMIN_ROLES } from '../../common/roles';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { gradeFor } from '../results/results.service';
import { fixedTermRange } from '../../common/school-date';
import { TermCalendar } from '../../common/term-calendar';
import { SaveRemarksDto } from './dto/save-remarks.dto';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Fixed term months (kept for callers that don't load the school's calendar). */
export const termRange = fixedTermRange;

/** 1 -> "1st", 22 -> "22nd", 13 -> "13th". */
export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};

/** Standard competition ranking: equal values share a position and the next one skips (1, 2, 2, 4). */
export function rank<T>(items: T[], value: (t: T) => number | null): Map<T, number> {
  const scored = items.filter((t) => value(t) !== null).sort((a, b) => value(b)! - value(a)!);
  const out = new Map<T, number>();
  scored.forEach((t, i) => out.set(t, i > 0 && value(t) === value(scored[i - 1]) ? out.get(scored[i - 1])! : i + 1));
  return out;
}

@Injectable()
export class ReportCardsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private remarksId = (seriesId: string, studentId: string) => `${seriesId}__${studentId}`;

  /** Report cards for every current student in a class for one exam: subjects, totals, positions, attendance and remarks. */
  async forClass(schoolId: string, seriesId: string, classId: string) {
    const seriesDoc = await getOwnedDoc(this.db.collection('examSeries'), seriesId, schoolId, 'Exam not found');
    const series = seriesDoc.data()!;
    const classDoc = await getOwnedDoc(this.db.collection('classes'), classId, schoolId, 'Class not found');
    const { from, to } = (await TermCalendar.load(this.db as any, schoolId)).range(series.term, series.session);

    const [school, papersSnap, resultsSnap, studentsSnap, attendanceSnap, remarksSnap, teachersSnap] = await Promise.all([
      this.db.collection('schools').doc(schoolId).get(),
      this.db.collection('exams').where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get(),
      this.db.collection('examResults').where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get(),
      this.db.collection('students').where('schoolId', '==', schoolId).where('classId', '==', classId).get(),
      this.db.collection('attendance').where('schoolId', '==', schoolId).where('classId', '==', classId).get(),
      this.db.collection('reportRemarks').where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get(),
      this.db.collection('teachers').where('schoolId', '==', schoolId).get(),
    ]);

    const papers = papersSnap.docs
      .filter((d) => d.data().classId === classId)
      .map((d) => ({ id: d.id, subject: String(d.data().title ?? ''), maxScore: Number(d.data().maxScore ?? 60) }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
    const students = studentsSnap.docs
      .filter((d) => d.data().status !== 'INACTIVE')
      .map((d) => ({ id: d.id, firstName: d.data().firstName ?? '', lastName: d.data().lastName ?? '', admissionNumber: d.data().admissionNumber ?? '', gender: d.data().gender ?? null }))
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
    const resultOf = new Map(resultsSnap.docs.map((d) => [`${d.data().examId}|${d.data().studentId}`, d.data()]));
    const remarksOf = new Map(remarksSnap.docs.map((d) => [d.data().studentId, d.data()]));

    // Subject statistics across the class (completed totals only).
    const subjectStats = new Map(
      papers.map((p) => {
        const entries = students.map((s) => ({ s, total: resultOf.get(`${p.id}|${s.id}`)?.score ?? null })) as { s: (typeof students)[number]; total: number | null }[];
        const totals = entries.map((e) => e.total).filter((t): t is number => typeof t === 'number');
        const positions = rank(entries, (e) => e.total);
        return [p.id, {
          average: totals.length ? round1(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
          highest: totals.length ? Math.max(...totals) : null,
          lowest: totals.length ? Math.min(...totals) : null,
          positionOf: new Map(entries.map((e) => [e.s.id, positions.get(e) ?? null])),
        }];
      }),
    );

    // Attendance this term, per student.
    const attendance = new Map<string, { present: number; absent: number; late: number; excused: number }>();
    for (const d of attendanceSnap.docs) {
      const a = d.data();
      if (a.date < from || a.date > to) continue;
      const c = attendance.get(a.studentId) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      if (a.status === 'PRESENT') c.present++;
      else if (a.status === 'ABSENT') c.absent++;
      else if (a.status === 'LATE') c.late++;
      else if (a.status === 'EXCUSED') c.excused++;
      attendance.set(a.studentId, c);
    }

    const cards = students.map((s) => {
      const subjects = papers.map((p) => {
        const r = resultOf.get(`${p.id}|${s.id}`);
        const st = subjectStats.get(p.id)!;
        return {
          examId: p.id,
          subject: p.subject,
          caMax: Math.max(0, 100 - p.maxScore),
          examMax: p.maxScore,
          ca: r?.ca ?? null,
          exam: r?.exam ?? null,
          total: r?.score ?? null,
          grade: r?.grade ?? null,
          position: st.positionOf.get(s.id) ?? null,
          classAverage: st.average,
          highest: st.highest,
          lowest: st.lowest,
        };
      });
      const totals = subjects.map((x) => x.total).filter((t): t is number => typeof t === 'number');
      const total = round1(totals.reduce((a, b) => a + b, 0));
      const average = totals.length ? round1(total / totals.length) : null;
      const att = attendance.get(s.id) ?? { present: 0, absent: 0, late: 0, excused: 0 };
      const rm = remarksOf.get(s.id);
      return {
        student: s,
        subjects,
        subjectsScored: totals.length,
        subjectsTotal: papers.length,
        total,
        average,
        grade: average === null ? null : gradeFor(average),
        position: null as number | null,
        attendance: { ...att, daysMarked: att.present + att.absent + att.late + att.excused, daysPresent: att.present + att.late },
        teacherRemark: rm?.teacherRemark ?? '',
        principalRemark: rm?.principalRemark ?? '',
      };
    });
    const positions = rank(cards, (c) => c.average);
    cards.forEach((c) => (c.position = positions.get(c) ?? null));
    const ranked = cards.filter((c) => c.position !== null).length;

    const formTeacher = teachersSnap.docs.find((d) => d.id === classDoc.data()!.teacherId);
    const averages = cards.map((c) => c.average).filter((a): a is number => a !== null);
    const sch = school.exists ? school.data()! : {};
    return {
      school: { name: sch.name ?? '', address: [sch.address, sch.city, sch.state].filter(Boolean).join(', '), phone: sch.phone ?? '', email: sch.email ?? '', logo: sch.logo ?? null, motto: sch.motto ?? '', principalName: sch.principalName ?? '' },
      series: { id: seriesId, name: series.name, term: series.term, session: series.session, startDate: series.startDate, endDate: series.endDate },
      class: { id: classId, name: classDoc.data()!.name, formTeacher: formTeacher ? `${formTeacher.data().firstName ?? ''} ${formTeacher.data().lastName ?? ''}`.trim() : null },
      attendancePeriod: { from, to },
      classSize: students.length,
      ranked,
      classAverage: averages.length ? round1(averages.reduce((a, b) => a + b, 0) / averages.length) : null,
      cards,
    };
  }

  /** Teachers write the class teacher's remark; only admins write the principal's. */
  async saveRemarks(schoolId: string, user: JwtPayload, dto: SaveRemarksDto) {
    if (dto.teacherRemark === undefined && dto.principalRemark === undefined) throw new BadRequestException('Nothing to save.');
    if (dto.principalRemark !== undefined && !(ADMIN_ROLES as readonly string[]).includes(user.role)) {
      throw new ForbiddenException("Only the principal or school admin can write the principal's remark.");
    }
    await getOwnedDoc(this.db.collection('examSeries'), dto.seriesId, schoolId, 'Exam not found');
    await getOwnedDoc(this.db.collection('students'), dto.studentId, schoolId, 'Student not found');
    const ref = this.db.collection('reportRemarks').doc(this.remarksId(dto.seriesId, dto.studentId));
    const existing = await ref.get();
    const tidy = (v: string) => v.trim().replace(/\s+/g, ' ');
    const data = {
      schoolId,
      seriesId: dto.seriesId,
      studentId: dto.studentId,
      teacherRemark: dto.teacherRemark !== undefined ? tidy(dto.teacherRemark) : existing.data()?.teacherRemark ?? '',
      principalRemark: dto.principalRemark !== undefined ? tidy(dto.principalRemark) : existing.data()?.principalRemark ?? '',
      updatedBy: user.sub,
      updatedAt: new Date(),
    };
    await ref.set(data);
    return { teacherRemark: data.teacherRemark, principalRemark: data.principalRemark };
  }
}
