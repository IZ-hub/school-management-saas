process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { schoolToday } from '../src/common/school-date';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Attendance register (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const today = schoolToday();
  const owner = token('SCHOOL_OWNER');
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const api = as(owner);
  const marks = () => [...(db.store.get('attendance')?.values() ?? [])];

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('users', 'owner-1', { schoolId: 'school-a', firstName: 'Funke', lastName: 'Bello', email: 'f@a.ng' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    db.seed('classes', 'gone', { schoolId: 'school-a', name: 'Old', status: 'INACTIVE' });
    db.seed('classes', 'b-class', { schoolId: 'school-b', name: 'JSS1', status: 'ACTIVE' });
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

  const save = (statuses: Record<string, string>, date = today, classId = 'jss1') =>
    api.put('/api/v1/attendance/register', { classId, date, marks: Object.entries(statuses).map(([studentId, status]) => ({ studentId, status })) });

  it('lists the class’s current students, sorted by surname, unmarked at first', async () => {
    const res = await api.get(`/api/v1/attendance/register?classId=jss1&date=${today}`).expect(200);
    expect(res.body.data).toMatchObject({ className: 'JSS1', date: today, takenAt: null, takenByName: null });
    expect(res.body.data.students.map((s: any) => [s.lastName, s.status])).toEqual([
      ['Bello', null],
      ['Ibrahim', null],
      ['Okafor', null],
    ]);
  });

  it('saves a register, records who took it, and updates instead of duplicating when saved again', async () => {
    const first = await save({ s1: 'PRESENT', s2: 'ABSENT', s3: 'LATE' }).expect(200);
    expect(first.body.data.takenByName).toBe('Funke Bello');
    expect(first.body.data.students.map((s: any) => s.status)).toEqual(['ABSENT', 'LATE', 'PRESENT']);
    const createdAt = marks().find((m) => m.studentId === 's1')!.createdAt;

    await save({ s1: 'PRESENT', s2: 'EXCUSED', s3: 'PRESENT' }).expect(200);
    expect(marks()).toHaveLength(3);
    expect(marks().find((m) => m.studentId === 's2')!.status).toBe('EXCUSED');
    expect(marks().find((m) => m.studentId === 's1')!.createdAt).toEqual(createdAt);
  });

  it('rejects future and malformed dates, unknown statuses, and students outside the class', async () => {
    expect((await save({ s1: 'PRESENT' }, '2999-01-01').expect(400)).body.message).toBe("You can't take a register for a future date.");
    expect((await save({ s1: 'PRESENT' }, '2026-02-30').expect(400)).body.message).toBe('Use a date like 2026-10-02.');
    await save({ s1: 'HERE' }).expect(400);
    await save({ s5: 'PRESENT' }).expect(400);
    await save({ s4: 'PRESENT' }).expect(400);
    await api.put('/api/v1/attendance/register', { classId: 'jss1', date: today, marks: [{ studentId: 's1', status: 'PRESENT' }, { studentId: 's1', status: 'ABSENT' }] }).expect(400);
    expect((await save({}, today, 'gone').expect(400)).body.message).toBe('That class has been deleted.');
    await save({ s1: 'PRESENT' }, today, 'b-class').expect(404);
    expect(marks()).toHaveLength(0);
  });

  it('shows which classes have taken today’s register, with rates that leave out excused absences', async () => {
    await save({ s1: 'PRESENT', s2: 'EXCUSED', s3: 'ABSENT' }).expect(200);
    const res = await api.get('/api/v1/attendance/today').expect(200);
    expect(res.body.data).toMatchObject({ date: today, classesTaken: 1, classesTotal: 2, rate: 50 });
    expect(res.body.data.classes.map((c: any) => [c.name, c.taken, c.rate])).toEqual([
      ['JSS1', true, 50],
      ['JSS2', false, null],
    ]);
  });

  it('keeps the day’s counts right when one mark is corrected', async () => {
    await save({ s1: 'PRESENT', s2: 'ABSENT', s3: 'PRESENT' }).expect(200);
    const id = [...db.store.get('attendance')!.entries()].find(([, m]) => m.studentId === 's2')![0];
    await api.patch(`/api/v1/attendance/${id}`, { status: 'LATE' }).expect(200);
    await api.patch(`/api/v1/attendance/${id}`, { status: 'GONE' }).expect(400);
    const res = await api.get('/api/v1/attendance/today').expect(200);
    expect(res.body.data.classes[0].counts).toEqual({ PRESENT: 2, ABSENT: 0, LATE: 1, EXCUSED: 0 });
    expect(res.body.data.rate).toBe(100);
  });

  it('feeds today’s attendance to the dashboard', async () => {
    let stats = (await api.get('/api/v1/dashboard/stats').expect(200)).body.data;
    expect(stats).toMatchObject({ attendanceRate: 0, attendanceEverTaken: false, attendanceToday: { rate: null, classesTaken: 0, classesTotal: 2 } });
    await save({ s1: 'PRESENT', s2: 'PRESENT', s3: 'ABSENT', }).expect(200);
    stats = (await api.get('/api/v1/dashboard/stats').expect(200)).body.data;
    expect(stats).toMatchObject({ attendanceRate: 67, attendanceEverTaken: true, attendanceToday: { rate: 67, classesTaken: 1, classesTotal: 2 } });
    // The two-week trend: 14 weekdays, today last; it follows corrections.
    expect(stats.attendanceTrend).toHaveLength(14);
    const isWeekend = [0, 6].includes(new Date(`${today}T12:00:00Z`).getUTCDay());
    if (!isWeekend) {
      expect(stats.attendanceTrend.at(-1)).toEqual({ date: today, rate: 67, classesTaken: 1 });
      const absentId = [...db.store.get('attendance')!.entries()].find(([, m]) => m.status === 'ABSENT')![0];
      await api.patch(`/api/v1/attendance/${absentId}`, { status: 'PRESENT' }).expect(200);
      const after = (await api.get('/api/v1/dashboard/stats').expect(200)).body.data;
      expect(after.attendanceTrend.at(-1)).toMatchObject({ date: today, rate: 100 });
    }
    expect(stats.attendanceTrend.every((d: any) => ![0, 6].includes(new Date(`${d.date}T12:00:00Z`).getUTCDay()))).toBe(true);
  });

  it('lets teachers take registers but not accountants or parents', async () => {
    // A teacher linked to a Teachers record who is JSS1's form teacher.
    db.seed('users', 't-1', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', teacherId: 'tr-1', firstName: 'Tunde', lastName: 'Ade' });
    db.peek('classes', 'jss1')!.teacherId = 'tr-1';
    await as(token('TEACHER', 't-1')).put('/api/v1/attendance/register', { classId: 'jss1', date: today, marks: [{ studentId: 's1', status: 'PRESENT' }] }).expect(200);
    await as(token('TEACHER', 't-1')).put('/api/v1/attendance/register', { classId: 'jss2', date: today, marks: [{ studentId: 's5', status: 'PRESENT' }] }).expect(403);
    await as(token('ACCOUNTANT', 'a-1')).get('/api/v1/attendance/today').expect(403);
    await as(token('PARENT', 'p-1')).get(`/api/v1/attendance/register?classId=jss1&date=${today}`).expect(403);
  });
});
