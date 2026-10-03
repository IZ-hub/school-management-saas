process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { ordinal, rank, termRange } from '../src/modules/report-cards/report-cards.service';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Report cards (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const api = as(token('SCHOOL_OWNER'));
  const cardsUrl = '/api/v1/report-cards?seriesId=ser1&classId=jss1';

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('schools', 'school-a', { name: 'Greenfield Academy', address: '12 Palm Rd', city: 'Lagos', phone: '0800', email: 'hi@g.ng' });
    db.seed('teachers', 't1', { schoolId: 'school-a', firstName: 'Tunde', lastName: 'Ade' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE', teacherId: 't1' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    db.seed('examSeries', 'ser1', { schoolId: 'school-a', name: 'First Term Examination 2026/2027', term: 'FIRST', session: '2026/2027', startDate: '2026-12-01', endDate: '2026-12-11' });
    db.seed('examSeries', 'b-ser', { schoolId: 'school-b', name: 'B', term: 'FIRST', session: '2026/2027' });
    const paper = (sub: string, title: string, maxScore = 60) =>
      db.seed('exams', `ser1__jss1__${sub}`, { schoolId: 'school-a', seriesId: 'ser1', classId: 'jss1', subjectId: sub, title, maxScore });
    paper('maths', 'Mathematics');
    paper('eng', 'English Language');
    paper('bsc', 'Basic Science');
    db.seed('exams', 'ser1__jss2__maths', { schoolId: 'school-a', seriesId: 'ser1', classId: 'jss2', subjectId: 'maths', title: 'Mathematics', maxScore: 60 });
    const st = (id: string, first: string, last: string, status = 'ACTIVE') =>
      db.seed('students', id, { schoolId: 'school-a', firstName: first, lastName: last, admissionNumber: `A/${id}`, classId: 'jss1', status });
    st('s1', 'Chioma', 'Okafor');
    st('s2', 'Ade', 'Bello');
    st('s3', 'Musa', 'Ibrahim');
    st('s4', 'Zainab', 'Yusuf');
    st('gone', 'Left', 'School', 'INACTIVE');
    const score = (sub: string, studentId: string, total: number) =>
      db.seed('examResults', `ser1__jss1__${sub}__${studentId}`, { schoolId: 'school-a', seriesId: 'ser1', examId: `ser1__jss1__${sub}`, classId: 'jss1', studentId, ca: 30, exam: total - 30, score: total, grade: null });
    // Okafor avg 80, Bello avg 70, Ibrahim avg 70 (tie), Yusuf has nothing.
    score('maths', 's1', 90); score('eng', 's1', 70); score('bsc', 's1', 80);
    score('maths', 's2', 70); score('eng', 's2', 70); score('bsc', 's2', 70);
    score('maths', 's3', 60); score('eng', 's3', 80);
    const mark = (studentId: string, date: string, status: string) =>
      db.seed('attendance', `${studentId}-${date}`, { schoolId: 'school-a', classId: 'jss1', studentId, date, status });
    mark('s1', '2026-09-10', 'PRESENT'); mark('s1', '2026-09-11', 'LATE'); mark('s1', '2026-09-12', 'ABSENT');
    mark('s1', '2026-08-20', 'PRESENT'); // last term: not counted

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ firestore: db })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  it('ranks with shared positions and writes ordinals', () => {
    const items = [{ v: 80 }, { v: 70 }, { v: 70 }, { v: null }, { v: 60 }];
    const r = rank(items, (x) => x.v);
    expect(items.map((i) => r.get(i) ?? null)).toEqual([1, 2, 2, null, 4]);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
    expect(termRange('SECOND', '2026/2027')).toEqual({ from: '2027-01-01', to: '2027-04-30' });
  });

  it('builds a card per current student with subjects, averages, positions and attendance', async () => {
    const res = await api.get(cardsUrl).expect(200);
    const d = res.body.data;
    expect(d.school).toMatchObject({ name: 'Greenfield Academy', address: '12 Palm Rd, Lagos' });
    expect(d.class).toMatchObject({ name: 'JSS1', formTeacher: 'Tunde Ade' });
    expect(d).toMatchObject({ classSize: 4, ranked: 3, attendancePeriod: { from: '2026-09-01', to: '2026-12-31' } });
    expect(d.cards.map((c: any) => [c.student.lastName, c.average, c.grade, c.position, c.subjectsScored])).toEqual([
      ['Bello', 70, 'A', 2, 3],
      ['Ibrahim', 70, 'A', 2, 2],
      ['Okafor', 80, 'A', 1, 3],
      ['Yusuf', null, null, null, 0],
    ]);
    const okafor = d.cards.find((c: any) => c.student.id === 's1');
    expect(okafor.subjects.map((s: any) => s.subject)).toEqual(['Basic Science', 'English Language', 'Mathematics']);
    expect(okafor.subjects.find((s: any) => s.subject === 'Mathematics')).toMatchObject({ ca: 30, exam: 60, total: 90, position: 1, classAverage: 73.3, highest: 90, lowest: 60, caMax: 40, examMax: 60 });
    expect(okafor.subjects.find((s: any) => s.subject === 'English Language')).toMatchObject({ position: 2 });
    expect(okafor.attendance).toMatchObject({ present: 1, late: 1, absent: 1, daysMarked: 3, daysPresent: 2 });
  });

  it('saves remarks; only admins write the principal’s remark', async () => {
    await api.put('/api/v1/report-cards/remarks', { seriesId: 'ser1', studentId: 's1', teacherRemark: '  A  hardworking   student. ', principalRemark: 'Excellent result.' }).expect(200);
    db.seed('users', 't-1', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', teacherId: 't1' }); // t1 is JSS1's form teacher
    const teacher = as(token('TEACHER', 't-1'));
    await teacher.put('/api/v1/report-cards/remarks', { seriesId: 'ser1', studentId: 's2', teacherRemark: 'Good effort.' }).expect(200);
    await teacher.put('/api/v1/report-cards/remarks', { seriesId: 'ser1', studentId: 's2', principalRemark: 'Hi' }).expect(403);
    await api.put('/api/v1/report-cards/remarks', { seriesId: 'ser1', studentId: 's1', teacherRemark: 'x'.repeat(301) }).expect(400);
    await api.put('/api/v1/report-cards/remarks', { seriesId: 'ser1', studentId: 's1' }).expect(400);
    const cards = (await api.get(cardsUrl).expect(200)).body.data.cards;
    expect(cards.find((c: any) => c.student.id === 's1')).toMatchObject({ teacherRemark: 'A hardworking student.', principalRemark: 'Excellent result.' });
    expect(cards.find((c: any) => c.student.id === 's2')).toMatchObject({ teacherRemark: 'Good effort.', principalRemark: '' });
  });

  it('keeps schools apart and blocks non-academic roles', async () => {
    await api.get('/api/v1/report-cards?seriesId=b-ser&classId=jss1').expect(404);
    await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).get(cardsUrl).expect(404);
    await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).put('/api/v1/report-cards/remarks', { seriesId: 'b-ser', studentId: 's1', teacherRemark: 'x' }).expect(404);
    await as(token('ACCOUNTANT', 'a-1')).get(cardsUrl).expect(403);
    await as(token('PARENT', 'p-1')).get(cardsUrl).expect(403);
  });
});
