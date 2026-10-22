process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { forgetBilling } from '../src/modules/auth/guards/jwt-auth.guard';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

// Only the clock is faked, so the HTTP server keeps working.
const REAL = ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'] as const;
/** Lagos is UTC+1, so 07:40 at school is 06:40Z. */
const at = (lagosTime: string) => new Date(`2026-10-22T${lagosTime}:00+01:00`);
const TODAY = '2026-10-22';

describe('Gate clock-in and clock-out with ID cards (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const owner = token('SCHOOL_OWNER');
  const teacher = token('TEACHER', 'teacher-1');
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const mark = (studentId: string) => db.store.get('attendance')?.get(`school-a__${TODAY}__${studentId}`);
  const scan = (code: string, mode?: string, t = teacher) => as(t).post('/api/v1/gate/scan', { code, ...(mode ? { mode } : {}) });

  beforeEach(async () => {
    jest.useFakeTimers({ now: at('07:40'), doNotFake: [...REAL] });
    db = new FakeFirestore();
    forgetBilling('school-a');
    db.seed('schools', 'school-a', { name: 'Greenfield', createdAt: new Date('2026-10-20') });
    db.seed('users', 'owner-1', { schoolId: 'school-a', firstName: 'Funke', lastName: 'Bello', email: 'f@a.ng' });
    db.seed('users', 'teacher-1', { schoolId: 'school-a', role: 'TEACHER', teacherId: 't1', firstName: 'Tunde', lastName: 'B', email: 't@a.ng' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    const st = (id: string, first: string, classId: string, status = 'ACTIVE', schoolId = 'school-a') =>
      db.seed('students', id, { schoolId, firstName: first, lastName: 'Test', admissionNumber: `A/${id}`, classId, status });
    st('s1', 'Chioma', 'jss1');
    st('s2', 'Ade', 'jss1');
    st('s3', 'Musa', 'jss2');
    st('gone', 'Left', 'jss1', 'INACTIVE');
    st('b1', 'Other', 'b-class', 'ACTIVE', 'school-b');

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
    jest.useRealTimers();
  });

  /** Issues cards and returns each student's QR text. */
  const issueCards = async () => {
    const res = await as(owner).get('/api/v1/gate/cards').expect(200);
    return Object.fromEntries(res.body.data.cards.map((c: any) => [c.studentId, c.qr])) as Record<string, string>;
  };

  it('issues cards once per student, with nothing personal in the QR, and only to admins', async () => {
    const first = await issueCards();
    expect(Object.keys(first).sort()).toEqual(['s1', 's2', 's3']); // not the inactive student or another school's
    expect(first.s1).toMatch(/^SP1-[A-HJ-NP-Z2-9]{10}$/);
    expect(await issueCards()).toEqual(first); // printing again keeps the same codes
    await as(teacher).get('/api/v1/gate/cards').expect(403);
    // The code never comes back through the normal student endpoints.
    const list = (await as(owner).get('/api/v1/students').expect(200)).body.data;
    expect(list.every((x: any) => x.cardCode === undefined)).toBe(true);
    expect((await as(owner).get('/api/v1/students/s1').expect(200)).body.data.cardCode).toBeUndefined();
    const jss1 = await as(owner).get('/api/v1/gate/cards?classId=jss1').expect(200);
    expect(jss1.body.data.cards.map((c: any) => c.studentId).sort()).toEqual(['s1', 's2']);
  });

  it('clocks a student in, ignores a quick repeat, then clocks them out', async () => {
    const qr = await issueCards();
    const first = (await scan(qr.s1).expect(201)).body.data;
    expect(first).toMatchObject({ action: 'IN', time: '07:40', clockIn: '07:40', clockOut: null, marked: 'PRESENT', late: false, student: { name: 'Chioma Test', className: 'JSS1' } });
    expect(mark('s1')).toMatchObject({ status: 'PRESENT', source: 'GATE', classId: 'jss1' });

    jest.setSystemTime(at('07:42'));
    expect((await scan(qr.s1).expect(201)).body.data).toMatchObject({ action: 'ALREADY_IN', clockIn: '07:40' });

    jest.setSystemTime(at('14:05'));
    expect((await scan(qr.s1).expect(201)).body.data).toMatchObject({ action: 'OUT', clockIn: '07:40', clockOut: '14:05' });
    jest.setSystemTime(at('14:06'));
    expect((await scan(qr.s1).expect(201)).body.data).toMatchObject({ action: 'ALREADY_OUT', clockOut: '14:05' });

    const today = (await as(teacher).get('/api/v1/gate/today').expect(200)).body.data;
    expect(today).toMatchObject({ date: TODAY, clockedIn: 1, clockedOut: 1, stillIn: 0 });
    expect(today.recent.map((e: any) => `${e.action} ${e.time}`)).toEqual(['OUT 14:05', 'IN 07:40']);
  });

  it('respects Arriving and Leaving modes, and a scan accepts the code typed by hand', async () => {
    const qr = await issueCards();
    expect((await scan(qr.s2, 'OUT').expect(201)).body.data).toMatchObject({ action: 'OUT', clockIn: null, marked: 'PRESENT' });
    expect((await scan(qr.s2, 'OUT').expect(201)).body.data.action).toBe('ALREADY_OUT');
    const typed = qr.s3.replace('SP1-', '').toLowerCase();
    expect((await scan(typed, 'IN').expect(201)).body.data).toMatchObject({ action: 'IN', student: { id: 's3' } });
    expect((await scan(qr.s3, 'IN').expect(201)).body.data.action).toBe('ALREADY_IN');
  });

  it('marks late arrivals after the school\'s time, and turns an absent mark into late', async () => {
    const qr = await issueCards();
    await as(teacher).put('/api/v1/gate/settings', { lateAfter: '07:45' }).expect(403); // admins set it
    await as(owner).put('/api/v1/gate/settings', { lateAfter: '7:45' }).expect(400);
    await as(owner).put('/api/v1/gate/settings', { lateAfter: '07:45' }).expect(200);

    expect((await scan(qr.s1).expect(201)).body.data).toMatchObject({ marked: 'PRESENT', late: false }); // 07:40
    jest.setSystemTime(at('08:10'));
    // The teacher took the register at 08:00 and marked Ade absent; Ade then arrives.
    await as(owner).put('/api/v1/attendance/register', { classId: 'jss1', date: TODAY, marks: [{ studentId: 's1', status: 'PRESENT' }, { studentId: 's2', status: 'ABSENT' }] }).expect(200);
    expect((await scan(qr.s2).expect(201)).body.data).toMatchObject({ action: 'IN', marked: 'LATE', late: true });
    expect(mark('s2')).toMatchObject({ status: 'LATE' });

    // The saved register's counts and the day's total follow the change.
    const reg = (await as(owner).get(`/api/v1/attendance/register?classId=jss1&date=${TODAY}`).expect(200)).body.data;
    expect(reg.students.find((s: any) => s.id === 's2')).toMatchObject({ status: 'LATE', clockIn: expect.anything(), clockOut: null });
    const summary = db.store.get('attendanceRegisters')?.get(`school-a__jss1__${TODAY}`);
    expect(summary?.counts).toMatchObject({ PRESENT: 1, LATE: 1, ABSENT: 0 });
    expect(db.store.get('attendanceDays')?.get(`school-a__${TODAY}`)).toMatchObject({ rate: 100 });
  });

  it('pre-ticks students in a register that has not been taken, without marking it taken', async () => {
    const qr = await issueCards();
    await scan(qr.s1).expect(201);
    const reg = (await as(owner).get(`/api/v1/attendance/register?classId=jss1&date=${TODAY}`).expect(200)).body.data;
    expect(reg).toMatchObject({ takenAt: null, gateUsed: true });
    expect(reg.students.map((s: any) => [s.id, s.status, !!s.clockIn])).toEqual([['s2', null, false], ['s1', 'PRESENT', true]]);
    expect(db.store.get('attendanceRegisters')?.get(`school-a__jss1__${TODAY}`)).toBeUndefined();
  });

  it('rejects unknown, replaced, other-school and departed students\' cards', async () => {
    const qr = await issueCards();
    await scan('hello').expect(400);
    await scan('SP1-ABCDEFGHJK').expect(404);
    const { qr: fresh } = (await as(owner).post('/api/v1/gate/cards/s1/reissue').expect(201)).body.data;
    expect(fresh).not.toBe(qr.s1);
    expect((await scan(qr.s1).expect(404)).body.message).toMatch(/replaced by a newer card/);
    expect((await scan(fresh).expect(201)).body.data.student.id).toBe('s1');
    await as(teacher).post('/api/v1/gate/cards/s1/reissue').expect(403);

    // A card from another school is unknown here.
    db.seed('students', 'b1', { schoolId: 'school-b', firstName: 'Other', lastName: 'Test', classId: 'b-class', status: 'ACTIVE', cardCode: 'ABCDEFGHJK' });
    await scan('SP1-ABCDEFGHJK').expect(404);
    // A student who has left.
    db.store.get('students')!.set('s3', { ...db.store.get('students')!.get('s3'), status: 'INACTIVE' });
    expect((await scan(qr.s3).expect(400)).body.message).toMatch(/no longer at the school/);
  });
});
