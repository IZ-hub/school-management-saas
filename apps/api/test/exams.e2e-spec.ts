process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { findClashes, seriesStatus } from '../src/modules/exams/exams.service';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Exams (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
    delete: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
  });
  const api = as(token('SCHOOL_OWNER'));
  const papers = () => [...(db.store.get('exams')?.entries() ?? [])].map(([id, p]): Record<string, any> => ({ id, ...p }));
  const series = { term: 'FIRST', session: '2026/2027', startDate: '2026-12-01', endDate: '2026-12-11', classIds: ['jss1', 'jss2'] };

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    db.seed('classes', 'jss3', { schoolId: 'school-a', name: 'JSS3', status: 'ACTIVE' });
    db.seed('classes', 'b-class', { schoolId: 'school-b', name: 'JSS1', status: 'ACTIVE' });
    db.seed('subjects', 'maths', { schoolId: 'school-a', name: 'Mathematics', code: 'MTH', status: 'ACTIVE' });
    db.seed('subjects', 'eng', { schoolId: 'school-a', name: 'English Language', code: 'ENG', status: 'ACTIVE' });
    db.seed('subjects', 'old', { schoolId: 'school-a', name: 'Latin', code: 'LAT', status: 'INACTIVE' });
    const ta = (id: string, classId: string, subjectId: string, teacherId: string | null) =>
      db.seed('teachingAssignments', id, { schoolId: 'school-a', classId, subjectId, teacherId });
    ta('a1', 'jss1', 'maths', 't-ade');
    ta('a2', 'jss1', 'eng', 't-bisi');
    ta('a3', 'jss2', 'maths', 't-ade');
    ta('a4', 'jss1', 'old', null);

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

  const create = async (body: object = series) => (await api.post('/api/v1/exam-series', body).expect(201)).body.data;

  it('creates a series with a default name and one paper per class subject, skipping deleted subjects', async () => {
    const s = await create();
    expect(s).toMatchObject({ name: 'First Term Examination 2026/2027', created: 3, classesWithoutSubjects: [], defaultMaxScore: 60 });
    expect(papers().map((p) => [p.classId, p.title, p.maxScore, p.date])).toEqual([
      ['jss1', 'Mathematics', 60, null],
      ['jss1', 'English Language', 60, null],
      ['jss2', 'Mathematics', 60, null],
    ]);
    await api.post('/api/v1/exam-series', series).expect(400);
    const list = (await api.get('/api/v1/exam-series').expect(200)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ papers: 3, scheduled: 0, clashCount: 0 });
  });

  it('rejects bad sessions, backwards dates, and classes from another school', async () => {
    await api.post('/api/v1/exam-series', { ...series, session: '2026/2028' }).expect(400);
    await api.post('/api/v1/exam-series', { ...series, session: '2026-2027' }).expect(400);
    await api.post('/api/v1/exam-series', { ...series, endDate: '2026-11-01' }).expect(400);
    await api.post('/api/v1/exam-series', { ...series, classIds: ['b-class'] }).expect(400);
    await api.post('/api/v1/exam-series', { ...series, term: 'FOURTH' }).expect(400);
    expect(papers()).toHaveLength(0);
  });

  it('schedules papers within the series dates and flags class and teacher clashes', async () => {
    const s = await create();
    const id = (c: string, sub: string) => `${s.id}__${c}__${sub}`;
    await api.patch(`/api/v1/exams/${id('jss1', 'maths')}`, { date: '2027-01-05', startTime: '09:00' }).expect(400);
    await api.patch(`/api/v1/exams/${id('jss1', 'maths')}`, { date: '2026-12-02', startTime: '25:00' }).expect(400);
    await api.patch(`/api/v1/exams/${id('jss1', 'maths')}`, { date: '2026-12-02', startTime: '9:00', maxScore: 70 }).expect(200);
    await api.patch(`/api/v1/exams/${id('jss1', 'eng')}`, { date: '2026-12-02', startTime: '10:00' }).expect(200);
    await api.patch(`/api/v1/exams/${id('jss2', 'maths')}`, { date: '2026-12-02', startTime: '10:30' }).expect(200);

    const detail = (await api.get(`/api/v1/exam-series/${s.id}`).expect(200)).body.data;
    expect(detail).toMatchObject({ papers: 3, scheduled: 3, status: 'SCHEDULED' });
    expect(detail.clashes.map((c: any) => c.reason).sort()).toEqual(['CLASS', 'TEACHER']);
    expect(detail.paperList.find((p: any) => p.id === id('jss1', 'maths'))).toMatchObject({ startTime: '09:00', maxScore: 70, teacherId: 't-ade' });

    await api.patch(`/api/v1/exams/${id('jss1', 'eng')}`, { date: null }).expect(200);
    const after = (await api.get(`/api/v1/exam-series/${s.id}`).expect(200)).body.data;
    expect(after).toMatchObject({ scheduled: 2, status: 'DRAFT' });
    expect(after.clashes.map((c: any) => c.reason)).toEqual(['TEACHER']);

    // Series dates can't shrink past scheduled papers.
    await api.patch(`/api/v1/exam-series/${s.id}`, { startDate: '2026-12-05' }).expect(400);
    await api.patch(`/api/v1/exam-series/${s.id}`, { endDate: '2026-12-04', name: 'Christmas Exams' }).expect(200);
  });

  it('imports a timetable by class name and subject name or code, reporting bad rows', async () => {
    const s = await create();
    const res = await api.post(`/api/v1/exam-series/${s.id}/schedule-import`, {
      records: [
        { className: 'jss 1', subject: 'MTH', date: '2026-12-01', startTime: '8:30', duration: '90' },
        { className: 'JSS1', subject: 'english language', date: '2026-12-01', startTime: '2:00 pm', maxScore: '40' },
        { className: 'JSS3', subject: 'MTH', date: '2026-12-01', startTime: '09:00' },
        { className: 'JSS2', subject: 'English Language', date: '2026-12-01', startTime: '09:00' },
        { className: 'JSS2', subject: 'MTH', date: '2027-03-01', startTime: '09:00' },
        { className: 'JSS2', subject: 'MTH', date: '2026-12-01' },
      ],
    }).expect(201);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.errors.map((e: any) => e.row)).toEqual([3, 4, 5, 6]);
    expect(papers().find((p) => p.id.endsWith('jss1__maths'))).toMatchObject({ date: '2026-12-01', startTime: '08:30', durationMinutes: 90 });
    expect(papers().find((p) => p.id.endsWith('jss1__eng'))).toMatchObject({ startTime: '14:00', maxScore: 40 });
  });

  it('adds classes and new subjects later without duplicating papers', async () => {
    const s = await create();
    db.seed('teachingAssignments', 'a5', { schoolId: 'school-a', classId: 'jss3', subjectId: 'eng', teacherId: 't-bisi' });
    db.seed('teachingAssignments', 'a6', { schoolId: 'school-a', classId: 'jss2', subjectId: 'eng', teacherId: 't-bisi' });
    const res = await api.post(`/api/v1/exam-series/${s.id}/papers`, { classIds: ['jss3'] }).expect(201);
    expect(res.body.data.created).toBe(2);
    expect(papers()).toHaveLength(5);
    await api.post(`/api/v1/exam-series/${s.id}/papers`, {}).expect(201);
    expect(papers()).toHaveLength(5);
  });

  it('refuses to delete papers that already have scores, otherwise deletes the series and its papers', async () => {
    const s = await create();
    db.seed('examResults', 'r1', { schoolId: 'school-a', examId: `${s.id}__jss1__maths`, studentId: 'x', score: 40 });
    await api.delete(`/api/v1/exams/${s.id}__jss1__maths`).expect(400);
    await api.delete(`/api/v1/exam-series/${s.id}`).expect(400);
    await api.delete(`/api/v1/exams/${s.id}__jss1__eng`).expect(200);
    db.store.get('examResults')!.clear();
    await api.delete(`/api/v1/exam-series/${s.id}`).expect(200);
    expect(papers()).toHaveLength(0);
  });

  it('keeps schools apart and lets teachers view but not change exams', async () => {
    const s = await create();
    await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).get(`/api/v1/exam-series/${s.id}`).expect(404);
    await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).patch(`/api/v1/exams/${s.id}__jss1__maths`, { maxScore: 10 }).expect(404);
    const teacher = as(token('TEACHER', 't-ade'));
    await teacher.get(`/api/v1/exam-series/${s.id}`).expect(200);
    await teacher.post('/api/v1/exam-series', { ...series, name: 'Mock' }).expect(403);
    await teacher.patch(`/api/v1/exams/${s.id}__jss1__maths`, { maxScore: 10 }).expect(403);
    await as(token('PARENT', 'p-1')).get('/api/v1/exam-series').expect(403);
  });

  it('shows the next exam on the dashboard', async () => {
    const s = await create();
    const stats = (await api.get('/api/v1/dashboard/stats').expect(200)).body.data;
    expect(stats.nextExam).toMatchObject({ id: s.id, name: 'First Term Examination 2026/2027', startDate: '2026-12-01' });
  });

  it('works out status and clashes', () => {
    expect(seriesStatus('2026-12-01', '2026-12-11', 3, 2, '2026-11-01')).toBe('DRAFT');
    expect(seriesStatus('2026-12-01', '2026-12-11', 3, 3, '2026-11-01')).toBe('SCHEDULED');
    expect(seriesStatus('2026-12-01', '2026-12-11', 3, 1, '2026-12-11')).toBe('IN_PROGRESS');
    expect(seriesStatus('2026-12-01', '2026-12-11', 3, 3, '2026-12-12')).toBe('COMPLETED');
    const p = (id: string, classId: string, startTime: string, teacherId: string | null = null) =>
      ({ id, seriesId: 's', classId, subjectId: id, title: id, date: '2026-12-01', startTime, durationMinutes: 60, maxScore: 60, teacherId });
    // Back-to-back papers don't clash.
    expect(findClashes([p('a', 'c1', '09:00'), p('b', 'c1', '10:00')])).toEqual([]);
    expect(findClashes([p('a', 'c1', '09:00'), p('b', 'c1', '09:59')])).toHaveLength(1);
    expect(findClashes([p('a', 'c1', '09:00', 't'), p('b', 'c2', '09:30', 't')])[0].reason).toBe('TEACHER');
  });
});
