import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { ACADEMIC_ROLES, ADMIN_ROLES, FINANCE_ROLES } from '../../common/roles';
import { TermCalendar } from '../../common/term-calendar';
import { inDateRange } from '../../common/aggregate';
import { TeachingScope } from '../../common/teaching-scope';
import { schoolToday } from '../../common/school-date';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { gradeFor } from '../results/results.service';
import { FeesService } from '../fees/fees.service';

const round1 = (n: number) => Math.round(n * 10) / 10;
const millis = (v: any) => v?.toMillis?.() ?? v?.getTime?.() ?? (v ? new Date(v).getTime() : 0);

@Injectable()
export class StudentProfileService {
  constructor(private readonly firebase: FirebaseService, private readonly fees: FeesService) {}

  private get db() {
    return this.firebase.firestore;
  }

  /** Everything about one student on one page. Each section is included only for roles allowed to see it. */
  async profile(schoolId: string, user: JwtPayload, studentId: string) {
    const doc = await getOwnedDoc(this.db.collection('students'), studentId, schoolId, 'Student not found');
    const s = doc.data()!;
    const scope = await TeachingScope.load(this.db as any, user);
    const academic = ACADEMIC_ROLES.includes(user.role) && !!s.classId && scope.canViewClass(s.classId);
    const finance = FINANCE_ROLES.includes(user.role);
    const admin = ADMIN_ROLES.includes(user.role);
    const messages = admin || user.role === 'ACCOUNTANT';

    const [cls, calendar] = await Promise.all([
      s.classId ? this.db.collection('classes').doc(s.classId).get() : Promise.resolve(null),
      TermCalendar.load(this.db as any, schoolId),
    ]);
    const ts = calendar.current();
    const formTeacherId = cls?.exists ? cls.data()!.teacherId : null;
    const formTeacher = formTeacherId ? await this.db.collection('teachers').doc(formTeacherId).get() : null;

    const [attendance, results, feeData, parents, inbox, history] = await Promise.all([
      academic ? this.attendance(schoolId, studentId, calendar, ts) : null,
      academic ? this.results(schoolId, studentId) : null,
      finance ? this.feeSection(schoolId, studentId, ts) : null,
      admin ? this.parents(schoolId, studentId) : null,
      messages ? this.messages(schoolId, studentId) : null,
      this.classHistory(schoolId, studentId),
    ]);

    return {
      student: {
        id: studentId,
        firstName: s.firstName ?? '',
        lastName: s.lastName ?? '',
        admissionNumber: s.admissionNumber ?? '',
        gender: s.gender ?? null,
        dateOfBirth: s.dateOfBirth ?? null,
        address: s.address ?? null,
        parentEmail: s.parentEmail ?? null,
        parentPhone: s.parentPhone ?? null,
        status: s.status ?? 'ACTIVE',
        leftReason: s.leftReason ?? null,
        leftSession: s.leftSession ?? null,
        enrolledAt: s.createdAt ?? null,
      },
      class: cls?.exists ? { id: cls.id, name: cls.data()!.name, formTeacher: formTeacher?.exists ? `${formTeacher.data()!.firstName ?? ''} ${formTeacher.data()!.lastName ?? ''}`.trim() : null } : null,
      term: ts,
      classHistory: history,
      attendance,
      results,
      fees: feeData,
      parents,
      messages: inbox,
      can: { academic, finance, admin, messages },
    };
  }

  private async attendance(schoolId: string, studentId: string, calendar: TermCalendar, ts: { term: string; session: string }) {
    const { from, to } = calendar.range(ts.term, ts.session);
    const docs = await inDateRange(this.db.collection('attendance').where('schoolId', '==', schoolId).where('studentId', '==', studentId), 'date', from, to);
    const marks = docs.map((d) => d.data()).filter((m) => m.date <= schoolToday());
    const count = (st: string) => marks.filter((m) => m.status === st).length;
    const expected = count('PRESENT') + count('LATE') + count('ABSENT');
    return {
      from, to,
      present: count('PRESENT'), late: count('LATE'), absent: count('ABSENT'), excused: count('EXCUSED'),
      rate: expected ? Math.round(((count('PRESENT') + count('LATE')) / expected) * 100) : null,
      // The days worth a look: absences and lateness, most recent first.
      notable: marks.filter((m) => m.status !== 'PRESENT').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((m) => ({ date: m.date, status: m.status })),
    };
  }

  /** Results grouped by exam, newest first, with each subject's total and grade. */
  private async results(schoolId: string, studentId: string) {
    const snap = await this.db.collection('examResults').where('schoolId', '==', schoolId).where('studentId', '==', studentId).get();
    const bySeries = new Map<string, FirebaseFirestore.DocumentData[]>();
    for (const d of snap.docs) if (d.data().seriesId) bySeries.set(d.data().seriesId, [...(bySeries.get(d.data().seriesId) ?? []), d.data()]);
    const exams = await Promise.all(
      [...bySeries.entries()].map(async ([seriesId, rows]) => {
        // Just this student's papers (one per subject), not the whole exam's.
        const [series, ...paperDocs] = await Promise.all([
          this.db.collection('examSeries').doc(seriesId).get(),
          ...[...new Set(rows.map((r) => r.examId as string))].map((id) => this.db.collection('exams').doc(id).get()),
        ]);
        const papers = { docs: paperDocs.filter((p) => p.exists) };
        if (!series.exists || series.data()!.schoolId !== schoolId) return null;
        const title = new Map(papers.docs.map((p) => [p.id, String(p.data()!.title ?? 'Subject')]));
        const subjects = rows
          .map((r) => ({ subject: title.get(r.examId) ?? 'Subject', ca: r.ca ?? null, exam: r.exam ?? null, total: r.score ?? null, grade: r.grade ?? null }))
          .sort((a, b) => a.subject.localeCompare(b.subject));
        const totals = subjects.map((x) => x.total).filter((t): t is number => typeof t === 'number');
        const average = totals.length ? round1(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
        const sd = series.data()!;
        return {
          seriesId, name: sd.name, term: sd.term, session: sd.session, startDate: sd.startDate,
          classId: rows[0].classId ?? null, published: !!sd.resultsPublished,
          subjects, average, grade: average === null ? null : gradeFor(average), scored: totals.length,
        };
      }),
    );
    return exams.filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  }

  private async feeSection(schoolId: string, studentId: string, ts: { term: string; session: string }) {
    const [statement, paySnap] = await Promise.all([
      this.fees.statement(schoolId, studentId, ts.term, ts.session),
      this.db.collection('feePayments').where('schoolId', '==', schoolId).where('studentId', '==', studentId).get(),
    ]);
    const { school: _school, ...current } = statement;
    const payments = paySnap.docs
      .map((d) => ({ id: d.id, receiptNumber: d.data().receiptNumber, amount: d.data().amount, method: d.data().method, paidOn: d.data().paidOn, term: d.data().term, session: d.data().session, voided: !!d.data().voided }))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || String(b.receiptNumber).localeCompare(String(a.receiptNumber)));
    return { current, payments, totalPaid: payments.filter((p) => !p.voided).reduce((a, p) => a + p.amount, 0) };
  }

  private async parents(schoolId: string, studentId: string) {
    const snap = await this.db.collection('users').where('schoolId', '==', schoolId).where('role', '==', 'PARENT').get();
    return snap.docs
      .filter((d) => (d.data().childIds ?? []).includes(studentId))
      .map((d) => ({ userId: d.id, firstName: d.data().firstName ?? '', lastName: d.data().lastName ?? '', email: d.data().email, phone: d.data().phone ?? null, status: d.data().status, lastLogin: millis(d.data().lastLogin) || null }));
  }

  private async messages(schoolId: string, studentId: string) {
    const snap = await this.db.collection('messageDeliveries').where('schoolId', '==', schoolId).where('studentId', '==', studentId).get();
    return snap.docs
      .map((d) => ({ id: d.id, text: d.data().text, createdAt: d.data().createdAt, sms: d.data().sms?.status ?? null }))
      .sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
      .slice(0, 10);
  }

  /** Class moves from end-of-session promotions (undone promotions are ignored). */
  private async classHistory(schoolId: string, studentId: string) {
    const [snap, classSnap] = await Promise.all([
      this.db.collection('promotions').where('schoolId', '==', schoolId).get(),
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
    ]);
    const names = new Map(classSnap.docs.map((d) => [d.id, String(d.data().name ?? '')]));
    return snap.docs
      .filter((d) => !d.data().undone)
      .map((d) => {
        const c = (d.data().changes ?? []).find((x: any) => x.studentId === studentId);
        return c ? { toSession: d.data().toSession as string, from: names.get(c.fromClassId) ?? 'Class', to: c.graduated ? 'Graduated' : names.get(c.toClassId) ?? 'Class', at: d.data().at } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.toSession.localeCompare(b.toSession));
  }
}
