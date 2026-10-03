process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { gradeFor, scoreSummary } from '../src/modules/results/results.service';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Results score sheets (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const api = as(token('SCHOOL_OWNER'));
  const paper = 'ser1__jss1__maths';
  const results = () => [...(db.store.get('examResults')?.values() ?? [])];
  const save = (scores: object[], examId = paper, t = api) => t.put('/api/v1/results/sheet', { examId, scores });

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('users', 'owner-1', { schoolId: 'school-a', firstName: 'Funke', lastName: 'Bello', email: 'f@a.ng' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    db.seed('examSeries', 'ser1', { schoolId: 'school-a', name: 'First Term Examination 2026/2027', startDate: '2026-12-01', endDate: '2026-12-11', classIds: ['jss1', 'jss2'] });
    const p = (id: string, classId: string, subjectId: string, title: string, maxScore = 60) =>
      db.seed('exams', id, { schoolId: 'school-a', seriesId: 'ser1', classId, subjectId, title, date: null, startTime: null, durationMinutes: 120, maxScore });
    p(paper, 'jss1', 'maths', 'Mathematics');
    p('ser1__jss1__eng', 'jss1', 'eng', 'English Language', 100);
    p('ser1__jss2__maths', 'jss2', 'maths', 'Mathematics');
    db.seed('exams', 'legacy', { schoolId: 'school-a', classId: 'jss1', subjectId: 'maths', title: 'Old test', date: '2026-01-01' });
    db.seed('exams', 'b-paper', { schoolId: 'school-b', seriesId: 'b-ser', classId: 'b', subjectId: 'm', title: 'Maths', maxScore: 60 });
    const st = (id: string, first: string, last: string, classId: string, status = 'ACTIVE') =>
      db.seed('students', id, { schoolId: 'school-a', firstName: first, lastName: last, admissionNumber: `A/${id}`, classId, status });
    st('s1', 'Chioma', 'Okafor', 'jss1');
    st('s2', 'Ade', 'Bello', 'jss1');
    st('s3', 'Musa', 'Ibrahim', 'jss1');
    st('s4', 'Left', 'School', 'jss1', 'INACTIVE');
    st('s5', 'Other', 'Class', 'jss2');

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

  it('grades totals on the A–F scale', () => {
    expect([100, 70, 69.9, 60, 50, 45, 44.5, 40, 39.9, 0].map(gradeFor)).toEqual(['A', 'A', 'B', 'B', 'C', 'D', 'E', 'E', 'F', 'F']);
    expect(scoreSummary(30, null, 40)).toEqual({ total: null, grade: null });
    expect(scoreSummary(null, 50, 40)).toEqual({ total: null, grade: null });
    expect(scoreSummary(null, 72, 0)).toEqual({ total: 72, grade: 'A' });
    expect(scoreSummary(25.5, 33, 40)).toEqual({ total: 58.5, grade: 'C' });
  });

  it('shows the class’s current students with CA out of 40 and exam out of 60', async () => {
    const res = await api.get(`/api/v1/results/sheet?examId=${paper}`).expect(200);
    expect(res.body.data).toMatchObject({ className: 'JSS1', subject: 'Mathematics', caMax: 40, examMax: 60, seriesName: 'First Term Examination 2026/2027' });
    expect(res.body.data.students.map((s: any) => [s.lastName, s.ca, s.exam, s.total])).toEqual([
      ['Bello', null, null, null],
      ['Ibrahim', null, null, null],
      ['Okafor', null, null, null],
    ]);
  });

  it('saves scores, works out totals and grades, and updates instead of duplicating', async () => {
    const first = await save([{ studentId: 's1', ca: 35, exam: 50 }, { studentId: 's2', ca: 20 }, { studentId: 's3', ca: 12.5, exam: 20 }]).expect(200);
    expect(first.body.data.students.map((s: any) => [s.lastName, s.total, s.grade])).toEqual([
      ['Bello', null, null],
      ['Ibrahim', 32.5, 'F'],
      ['Okafor', 85, 'A'],
    ]);
    expect(first.body.data.updatedByName).toBe('Funke Bello');
    expect(results()).toHaveLength(3);

    await save([{ studentId: 's2', exam: 41 }]).expect(200);
    expect(results()).toHaveLength(3);
    expect(results().find((r) => r.studentId === 's2')).toMatchObject({ ca: 20, exam: 41, score: 61, grade: 'B', seriesId: 'ser1', classId: 'jss1' });

    // Clearing both parts removes the result.
    await save([{ studentId: 's3', ca: null, exam: null }]).expect(200);
    expect(results().map((r) => r.studentId).sort()).toEqual(['s1', 's2']);
  });

  it('rejects scores over the max, students outside the class, duplicates and bad numbers', async () => {
    expect((await save([{ studentId: 's1', ca: 41 }]).expect(400)).body.message).toBe("Chioma Okafor's CA is 41, but CA is out of 40.");
    expect((await save([{ studentId: 's1', exam: 61 }]).expect(400)).body.message).toBe("Chioma Okafor's exam score is 61, but this paper is out of 60.");
    await save([{ studentId: 's1', exam: -1 }]).expect(400);
    await save([{ studentId: 's1', exam: 10.25 }]).expect(400);
    await save([{ studentId: 's1', exam: '50' }]).expect(400);
    await save([{ studentId: 's5', exam: 10 }]).expect(400);
    await save([{ studentId: 's4', exam: 10 }]).expect(400);
    await save([{ studentId: 's1', exam: 10 }, { studentId: 's1', exam: 20 }]).expect(400);
    // A paper marked out of 100 has no CA.
    await save([{ studentId: 's1', ca: 5, exam: 80 }], 'ser1__jss1__eng').expect(400);
    const eng = await save([{ studentId: 's1', exam: 80 }], 'ser1__jss1__eng').expect(200);
    expect(eng.body.data.students.find((s: any) => s.id === 's1')).toMatchObject({ total: 80, grade: 'A' });
    // Old-style exams and other schools' papers.
    await api.get('/api/v1/results/sheet?examId=legacy').expect(400);
    await api.get('/api/v1/results/sheet?examId=b-paper').expect(404);
    await save([{ studentId: 's1', exam: 10 }], 'b-paper').expect(404);
    expect(results()).toHaveLength(1);
  });

  it('reports scoring progress and averages for each paper', async () => {
    await save([{ studentId: 's1', ca: 30, exam: 40 }, { studentId: 's2', ca: 20, exam: 30 }, { studentId: 's3', ca: 10 }]).expect(200);
    const res = await api.get('/api/v1/results/progress?seriesId=ser1').expect(200);
    const maths1 = res.body.data.find((p: any) => p.examId === paper);
    expect(maths1).toMatchObject({ students: 3, complete: 2, started: 3, average: 60 });
    expect(res.body.data.find((p: any) => p.examId === 'ser1__jss2__maths')).toMatchObject({ students: 1, complete: 0, average: null });
    await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).get('/api/v1/results/progress?seriesId=ser1').expect(404);
  });

  it('stops a paper’s max score being changed below scores already entered', async () => {
    await save([{ studentId: 's1', ca: 35, exam: 55 }]).expect(200);
    expect((await api.patch(`/api/v1/exams/${paper}`, { maxScore: 50 }).expect(400)).body.message).toMatch(/already scored 55/);
    expect((await api.patch(`/api/v1/exams/${paper}`, { maxScore: 70 }).expect(400)).body.message).toMatch(/can't be above 65/);
    await api.patch(`/api/v1/exams/${paper}`, { maxScore: 65 }).expect(200);
    const sheet = await api.get(`/api/v1/results/sheet?examId=${paper}`).expect(200);
    expect(sheet.body.data).toMatchObject({ caMax: 35, examMax: 65 });
  });

  it('lets teachers enter scores but not accountants or parents', async () => {
    db.seed('users', 't-1', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', teacherId: 'tr-1' });
    db.seed('teachingAssignments', 'ta-1', { schoolId: 'school-a', classId: 'jss1', subjectId: 'maths', teacherId: 'tr-1' });
    await save([{ studentId: 's1', exam: 40 }], paper, as(token('TEACHER', 't-1'))).expect(200);
    await save([{ studentId: 's1', exam: 40 }], 'ser1__jss1__eng', as(token('TEACHER', 't-1'))).expect(403);
    await as(token('ACCOUNTANT', 'a-1')).get(`/api/v1/results/sheet?examId=${paper}`).expect(403);
    await save([{ studentId: 's1', exam: 40 }], paper, as(token('PARENT', 'p-1'))).expect(403);
  });
});
