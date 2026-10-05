process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { currentTermSession, fixedTermRange, schoolToday } from '../src/common/school-date';
import { FakeFirestore } from './fake-firestore';

/**
 * Database reads per page for a large school (1,500 students, 30 classes, a term of attendance,
 * a full exam's results, fees and payments). Firestore bills per document read, and big reads are
 * slow, so each page has a budget. A change that makes a page read far more fails here.
 */
const CLASSES = 30;
const PER_CLASS = 50;
const SUBJECTS = 12;
const DAYS = 60;

const token = (role: string, sub: string) => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId: 'big' }, process.env.JWT_SECRET!);

function seedBigSchool(db: FakeFirestore) {
  const ts = currentTermSession();
  const S = 'big';
  const put = (col: string, id: string, data: any) => db.seed(col, id, { schoolId: S, ...data });
  put('schools', S, { name: 'Big School' });
  db.store.get('schools')!.get(S)!.schoolId = undefined;
  put('users', 'owner', { role: 'SCHOOL_OWNER', status: 'ACTIVE', email: 'o@a.ng', firstName: 'O', lastName: 'W' });
  put('users', 'teacher', { role: 'TEACHER', status: 'ACTIVE', email: 't@a.ng', teacherId: 't0' });
  put('users', 'parent', { role: 'PARENT', status: 'ACTIVE', email: 'p@a.ng', childIds: ['c0-s0'], firstName: 'P' });
  for (let t = 0; t < 40; t++) put('teachers', `t${t}`, { firstName: `T${t}`, lastName: 'X', status: 'ACTIVE' });
  for (let j = 0; j < SUBJECTS; j++) put('subjects', `sub${j}`, { name: `Subject ${j}`, code: `S${j}`, status: 'ACTIVE' });
  put('examSeries', 'ser', { name: 'First Term Examination', term: ts.term, session: ts.session, startDate: '2026-12-01', endDate: '2026-12-11', classIds: Array.from({ length: CLASSES }, (_, c) => `c${c}`), resultsPublished: true });
  const { from } = fixedTermRange(ts.term, ts.session);
  const days = Array.from({ length: DAYS }, (_, d) => new Date(new Date(`${from}T12:00:00Z`).getTime() + d * 86400000).toISOString().slice(0, 10)).filter((d) => d <= schoolToday());
  for (let c = 0; c < CLASSES; c++) {
    const cid = `c${c}`;
    put('classes', cid, { name: `Class ${c}`, status: 'ACTIVE', capacity: 60, teacherId: `t${c % 40}` });
    put('feeSchedules', `${ts.session.replace('/', '-')}__${ts.term}__${cid}`, { term: ts.term, session: ts.session, classId: cid, items: [{ name: 'Tuition', amount: 90000 }], total: 90000 });
    for (let j = 0; j < SUBJECTS; j++) {
      put('teachingAssignments', `${cid}-sub${j}`, { classId: cid, subjectId: `sub${j}`, teacherId: `t${(c + j) % 40}` });
      put('exams', `ser__${cid}__sub${j}`, { seriesId: 'ser', classId: cid, subjectId: `sub${j}`, title: `Subject ${j}`, maxScore: 60, date: null, startTime: null, durationMinutes: 120, scoreStats: { complete: PER_CLASS, started: PER_CLASS, sum: 70 * PER_CLASS } });
    }
    for (const d of days) put('attendanceRegisters', `${S}__${cid}__${d}`, { classId: cid, date: d, takenAt: new Date(), counts: { PRESENT: PER_CLASS, ABSENT: 0, LATE: 0, EXCUSED: 0 } });
    for (let k = 0; k < PER_CLASS; k++) {
      const sid = `${cid}-s${k}`;
      put('students', sid, { firstName: `F${k}`, lastName: `L${c}`, admissionNumber: `A/${c}/${k}`, classId: cid, status: 'ACTIVE', createdAt: new Date() });
      for (let j = 0; j < SUBJECTS; j++) put('examResults', `ser__${cid}__sub${j}__${sid}`, { seriesId: 'ser', examId: `ser__${cid}__sub${j}`, classId: cid, studentId: sid, ca: 30, exam: 40, score: 70, grade: 'A' });
      for (const d of days) put('attendance', `${S}__${d}__${sid}`, { classId: cid, studentId: sid, date: d, status: 'PRESENT' });
      put('feePayments', `pay-${sid}`, { studentId: sid, studentName: `F${k} L${c}`, admissionNumber: `A/${c}/${k}`, className: `Class ${c}`, classId: cid, term: ts.term, session: ts.session, amount: 50000, method: 'CASH', paidOn: from, receiptNumber: `RCP-${sid}`, voided: false });
    }
  }
  return { ts, days };
}

describe('Read budget for a large school (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const owner = token('SCHOOL_OWNER', 'owner');
  let ctx: ReturnType<typeof seedBigSchool>;
  const report: [string, number][] = [];

  beforeAll(async () => {
    db = new FakeFirestore();
    ctx = seedBigSchool(db);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FirebaseService).useValue({ firestore: db }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    await app.close();
    // A readable summary when run on its own: npx jest --config ./test/jest-e2e.json read-budget
    console.log(report.map(([k, n]) => `${String(n).padStart(7)}  ${k}`).join('\n'));
  });

  /** Runs a request and returns how many documents it read. */
  const reads = async (label: string, req: () => request.Test, status = 200) => {
    // Warm the sign-in cache so the count is the page's own reads.
    await http.get('/api/v1/classes').set('Authorization', `Bearer ${owner}`);
    db.store.reads = 0;
    await req().expect(status);
    const n = db.store.reads ?? 0;
    report.push([label, n]);
    return n;
  };
  const as = (t: string) => ({
    get: (u: string) => () => http.get(u).set('Authorization', `Bearer ${t}`),
    put: (u: string, b: object) => () => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    post: (u: string, b: object) => () => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const o = as(owner);

  // Ceilings (about 30% above what each page reads today). Pages that list everyone
  // (students, fees, payments) read once per student or payment by design.
  const BUDGET: Record<string, number> = {
    'GET dashboard/stats': 250,
    'GET dashboard/class-sizes': 100,
    'GET students': 2000,
    'GET students/:id/profile': 150,
    'GET attendance/today': 100,
    'GET attendance/register (1 class)': 150,
    'PUT attendance/register (1 class)': 350,
    'GET exam-series': 950,
    'GET exam-series/:id': 950,
    'GET results/progress': 520,
    'GET results/sheet (1 paper)': 150,
    'PUT results/sheet (1 paper)': 280,
    'GET report-cards (1 class)': 3300,
    'GET fees/overview': 4000,
    'GET fees/statement/:id': 20,
    'GET payments': 2000,
    'GET timetable/overview': 600,
    'POST messages/preview (owing)': 6000,
    'GET promotion/plan': 2000,
    'GET parent/children/:id (parent)': 70,
  };

  it('keeps each page within its read budget', async () => {
    const today = schoolToday();
    const check = async (label: string, req: () => request.Test, status = 200) => {
      const n = await reads(label, req, status);
      expect({ page: label, reads: n, within: n <= BUDGET[label] }).toEqual({ page: label, reads: n, within: true });
    };
    await check('GET dashboard/stats', o.get('/api/v1/dashboard/stats'));
    await check('GET dashboard/class-sizes', o.get('/api/v1/dashboard/class-sizes'));
    await check('GET students', o.get('/api/v1/students'));
    await check('GET students/:id/profile', o.get('/api/v1/students/c0-s0/profile'));
    await check('GET attendance/today', o.get('/api/v1/attendance/today'));
    await check('GET attendance/register (1 class)', o.get(`/api/v1/attendance/register?classId=c0&date=${today}`));
    await check('PUT attendance/register (1 class)', o.put('/api/v1/attendance/register', { classId: 'c1', date: today, marks: Array.from({ length: PER_CLASS }, (_, k) => ({ studentId: `c1-s${k}`, status: 'PRESENT' })) }));
    await check('GET exam-series', o.get('/api/v1/exam-series'));
    await check('GET exam-series/:id', o.get('/api/v1/exam-series/ser'));
    await check('GET results/progress', o.get('/api/v1/results/progress?seriesId=ser'));
    await check('GET results/sheet (1 paper)', o.get('/api/v1/results/sheet?examId=ser__c0__sub0'));
    await check('PUT results/sheet (1 paper)', o.put('/api/v1/results/sheet', { examId: 'ser__c0__sub0', scores: [{ studentId: 'c0-s0', ca: 31, exam: 41 }] }));
    await check('GET report-cards (1 class)', o.get('/api/v1/report-cards?seriesId=ser&classId=c0'));
    await check('GET fees/overview', o.get('/api/v1/fees/overview'));
    await check('GET fees/statement/:id', o.get('/api/v1/fees/statement/c0-s0'));
    await check('GET payments', o.get('/api/v1/payments'));
    await check('GET timetable/overview', o.get('/api/v1/timetable/overview'));
    await check('POST messages/preview (owing)', o.post('/api/v1/messages/preview', { audience: 'OWING', text: 'Hi {student}', sms: false }), 201);
    await check('GET promotion/plan', o.get('/api/v1/promotion/plan'));
    await check('GET parent/children/:id (parent)', as(token('PARENT', 'parent')).get('/api/v1/parent/children/c0-s0'));
  }, 300_000);

  it('still works for exams scored before summaries were kept, then gets cheap', async () => {
    // Older papers have no score summary: the first view works it out once and stores it.
    for (const [, paper] of db.store.get('exams')!) delete paper.scoreStats;
    const first = await reads('GET results/progress (older exam, first view)', o.get('/api/v1/results/progress?seriesId=ser'));
    const second = await reads('GET results/progress (older exam, after)', o.get('/api/v1/results/progress?seriesId=ser'));
    expect(second).toBeLessThanOrEqual(BUDGET['GET results/progress']);
    expect(first).toBeGreaterThan(second);
    const progress = (await http.get('/api/v1/results/progress?seriesId=ser').set('Authorization', `Bearer ${owner}`)).body.data;
    expect(progress.find((p: any) => p.examId === 'ser__c2__sub0')).toMatchObject({ students: PER_CLASS, complete: PER_CLASS, average: 70 });
  }, 300_000);
});
