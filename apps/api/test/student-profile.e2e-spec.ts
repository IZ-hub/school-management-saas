process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { currentTermSession, schoolToday } from '../src/common/school-date';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub: string, schoolId = 'school-a') => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Student profile (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const ts = currentTermSession();
  const get = (t: string, id = 's1') => http.get(`/api/v1/students/${id}/profile`).set('Authorization', `Bearer ${t}`);

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('schools', 'school-a', { name: 'Greenfield' });
    db.seed('users', 'u-ade', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', teacherId: 'tr-ade' });
    db.seed('users', 'u-ola', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', teacherId: 'tr-ola' });
    db.seed('users', 'p1', { schoolId: 'school-a', role: 'PARENT', status: 'ACTIVE', firstName: 'Ngozi', lastName: 'Okafor', email: 'ngozi@mail.com', phone: '0803', childIds: ['s1'] });
    db.seed('teachers', 'tr-ade', { schoolId: 'school-a', firstName: 'Ade', lastName: 'Bello' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE', teacherId: 'tr-ade' });
    db.seed('students', 's1', { schoolId: 'school-a', firstName: 'Chioma', lastName: 'Okafor', admissionNumber: 'GFA/1', classId: 'jss2', status: 'ACTIVE', gender: 'FEMALE', parentPhone: '0803' });
    db.seed('students', 'b1', { schoolId: 'school-b', firstName: 'Other', lastName: 'School', classId: 'x', status: 'ACTIVE' });
    // Promoted from JSS1 into JSS2 last session; an undone promotion is ignored.
    db.seed('promotions', 'pr1', { schoolId: 'school-a', toSession: ts.session, at: new Date(), undone: false, changes: [{ studentId: 's1', fromClassId: 'jss1', toClassId: 'jss2', graduated: false }] });
    db.seed('promotions', 'pr0', { schoolId: 'school-a', toSession: '2020/2021', at: new Date(), undone: true, changes: [{ studentId: 's1', fromClassId: 'jss2', toClassId: null, graduated: true }] });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE', teacherId: 'tr-ola' });
    // Attendance this term
    db.seed('attendance', 'a1', { schoolId: 'school-a', classId: 'jss2', studentId: 's1', date: schoolToday(), status: 'ABSENT' });
    db.seed('attendance', 'a2', { schoolId: 'school-a', classId: 'jss2', studentId: 's1', date: `${schoolToday().slice(0, 8)}01`, status: 'PRESENT' });
    // An exam with two subjects
    db.seed('examSeries', 'ser1', { schoolId: 'school-a', name: 'First Term Examination', term: ts.term, session: ts.session, startDate: '2026-12-01', resultsPublished: true });
    db.seed('exams', 'ser1__jss2__maths', { schoolId: 'school-a', seriesId: 'ser1', classId: 'jss2', subjectId: 'maths', title: 'Mathematics' });
    db.seed('exams', 'ser1__jss2__eng', { schoolId: 'school-a', seriesId: 'ser1', classId: 'jss2', subjectId: 'eng', title: 'English Language' });
    db.seed('examResults', 'r1', { schoolId: 'school-a', seriesId: 'ser1', examId: 'ser1__jss2__maths', classId: 'jss2', studentId: 's1', ca: 30, exam: 50, score: 80, grade: 'A' });
    db.seed('examResults', 'r2', { schoolId: 'school-a', seriesId: 'ser1', examId: 'ser1__jss2__eng', classId: 'jss2', studentId: 's1', ca: 25, exam: 30, score: 55, grade: 'C' });
    // Fees and a payment
    db.seed('feeSchedules', `${ts.session.replace('/', '-')}__${ts.term}__jss2`, { schoolId: 'school-a', term: ts.term, session: ts.session, classId: 'jss2', items: [{ name: 'Tuition', amount: 90000 }], total: 90000 });
    db.seed('feePayments', 'pay1', { schoolId: 'school-a', studentId: 's1', classId: 'jss2', term: ts.term, session: ts.session, amount: 40000, method: 'CASH', paidOn: '2026-09-20', receiptNumber: 'RCP-2026-0001', voided: false });
    db.seed('messageDeliveries', 'm1', { schoolId: 'school-a', messageId: 'msg', studentId: 's1', text: 'Fee reminder', createdAt: new Date(), sms: { status: 'SENT' } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FirebaseService).useValue({ firestore: db }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  it('brings everything about a student together for an admin', async () => {
    const p = (await get(token('SCHOOL_OWNER', 'owner')).expect(200)).body.data;
    expect(p.student).toMatchObject({ firstName: 'Chioma', admissionNumber: 'GFA/1', status: 'ACTIVE' });
    expect(p.class).toMatchObject({ name: 'JSS2' });
    expect(p.classHistory).toEqual([expect.objectContaining({ toSession: ts.session, from: 'JSS1', to: 'JSS2' })]);
    expect(p.attendance).toMatchObject({ present: 1, absent: 1, rate: 50 });
    expect(p.attendance.notable).toEqual([{ date: schoolToday(), status: 'ABSENT' }]);
    expect(p.results).toEqual([expect.objectContaining({ name: 'First Term Examination', average: 67.5, grade: 'B', scored: 2, published: true })]);
    expect(p.results[0].subjects.map((s: any) => [s.subject, s.total])).toEqual([['English Language', 55], ['Mathematics', 80]]);
    expect(p.fees.current).toMatchObject({ due: 90000, paid: 40000, balance: 50000 });
    expect(p.fees.payments).toEqual([expect.objectContaining({ receiptNumber: 'RCP-2026-0001', amount: 40000 })]);
    expect(p.parents).toEqual([expect.objectContaining({ firstName: 'Ngozi', status: 'ACTIVE' })]);
    expect(p.messages).toEqual([expect.objectContaining({ text: 'Fee reminder', sms: 'SENT' })]);
    expect(p.can).toEqual({ academic: true, finance: true, admin: true, messages: true });
  });

  it('shows each role only its own sections', async () => {
    // Ola is JSS2's form teacher: academics, but no fees, parents or messages.
    const ola = (await get(token('TEACHER', 'u-ola')).expect(200)).body.data;
    expect(ola.can).toEqual({ academic: true, finance: false, admin: false, messages: false });
    expect(ola.results).toHaveLength(1);
    expect([ola.fees, ola.parents, ola.messages]).toEqual([null, null, null]);
    // Ade doesn't teach JSS2: basic details only.
    const ade = (await get(token('TEACHER', 'u-ade')).expect(200)).body.data;
    expect([ade.attendance, ade.results, ade.fees]).toEqual([null, null, null]);
    expect(ade.student.firstName).toBe('Chioma');
    // Accountant: fees and messages, no academics.
    const acc = (await get(token('ACCOUNTANT', 'acc')).expect(200)).body.data;
    expect(acc.can).toEqual({ academic: false, finance: true, admin: false, messages: true });
    expect([acc.attendance, acc.results, acc.parents]).toEqual([null, null, null]);
    expect(acc.fees.current.balance).toBe(50000);
  });

  it('keeps other schools and parents out', async () => {
    await get(token('SCHOOL_OWNER', 'owner'), 'b1').expect(404);
    await get(token('SCHOOL_OWNER', 'owner-b', 'school-b')).expect(404);
    await get(token('PARENT', 'p1')).expect(403);
  });
});
