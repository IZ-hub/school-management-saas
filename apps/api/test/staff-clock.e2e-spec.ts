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

describe('Staff clock-in and clock-out with staff ID cards (e2e)', () => {
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
    db.seed('teachers', 't1', { schoolId: 'school-a', firstName: 'Tunde', lastName: 'Bakare', employeeNumber: 'EMP-01', department: 'Sciences', status: 'ACTIVE' });
    db.seed('teachers', 't2', { schoolId: 'school-a', firstName: 'Amaka', lastName: 'Obi', employeeNumber: 'EMP-02', status: 'ACTIVE' });
    db.seed('teachers', 't-gone', { schoolId: 'school-a', firstName: 'Old', lastName: 'Hand', status: 'INACTIVE' });
    db.seed('users', 'acct-1', { schoolId: 'school-a', role: 'ACCOUNTANT', status: 'ACTIVE', firstName: 'Bisi', lastName: 'Ade', email: 'b@a.ng' });
    db.seed('users', 'parent-1', { schoolId: 'school-a', role: 'PARENT', status: 'ACTIVE', firstName: 'Pa', lastName: 'Rent', email: 'p@a.ng' });
    db.seed('users', 'off-1', { schoolId: 'school-a', role: 'PRINCIPAL', status: 'DISABLED', firstName: 'Off', lastName: 'Line', email: 'o@a.ng' });
    db.seed('teachers', 'tb', { schoolId: 'school-b', firstName: 'Bee', lastName: 'Teacher', status: 'ACTIVE' });

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

  const staffCards = async () => {
    const res = await as(owner).get('/api/v1/gate/staff-cards').expect(200);
    return Object.fromEntries(res.body.data.cards.map((c: any) => [c.key, c])) as Record<string, any>;
  };

  it('issues staff cards to teachers and staff accounts, admins only, codes kept apart from the records', async () => {
    const cards = await staffCards();
    // teacher-1 (a TEACHER account linked to t1) is covered by t1's card; the owner has an account of their own.
    expect(Object.keys(cards).sort()).toEqual(['T_t1', 'T_t2', 'U_acct-1', 'U_owner-1']);
    expect(cards.T_t1).toMatchObject({ firstName: 'Tunde', role: 'Teacher · Sciences', number: 'EMP-01', qr: expect.stringMatching(/^SP1-[A-HJ-NP-Z2-9]{10}$/) });
    expect(cards['U_acct-1']).toMatchObject({ role: 'Accountant', number: '' });
    expect((await staffCards()).T_t1.qr).toBe(cards.T_t1.qr);
    await as(teacher).get('/api/v1/gate/staff-cards').expect(403);
    const t1 = (await as(owner).get('/api/v1/teachers/t1').expect(200)).body.data;
    expect(JSON.stringify(t1)).not.toContain(cards.T_t1.qr.slice(4));
  });

  it('clocks staff in and out at the gate, marks late arrivals, and shows them on the day sheet', async () => {
    await as(owner).put('/api/v1/gate/settings', { staffLateAfter: '07:30' }).expect(200);
    expect((await as(owner).get('/api/v1/gate/settings').expect(200)).body.data).toEqual({ lateAfter: null, staffLateAfter: '07:30' });
    const cards = await staffCards();

    jest.setSystemTime(at('07:20'));
    expect((await scan(cards.T_t2.qr).expect(201)).body.data).toMatchObject({ who: 'STAFF', action: 'IN', late: false, marked: null, student: { name: 'Amaka Obi', className: 'Teacher' } });
    jest.setSystemTime(at('07:40'));
    expect((await scan(cards.T_t1.qr).expect(201)).body.data).toMatchObject({ who: 'STAFF', action: 'IN', late: true, clockIn: '07:40' });
    jest.setSystemTime(at('07:42'));
    expect((await scan(cards.T_t1.qr).expect(201)).body.data.action).toBe('ALREADY_IN');
    jest.setSystemTime(at('15:10'));
    expect((await scan(cards.T_t1.qr).expect(201)).body.data).toMatchObject({ action: 'OUT', clockIn: '07:40', clockOut: '15:10', late: false });

    const day = (await as(owner).get(`/api/v1/gate/staff-attendance?date=${TODAY}`).expect(200)).body.data;
    expect(day).toMatchObject({ date: TODAY, total: 4, arrived: 2, late: 1, notIn: 2 });
    const byKey = Object.fromEntries(day.staff.map((r: any) => [r.key, r]));
    expect(byKey.T_t1).toMatchObject({ clockIn: '07:40', clockOut: '15:10', late: true });
    expect(byKey['U_acct-1']).toMatchObject({ clockIn: null, clockOut: null, late: false });
    await as(teacher).get('/api/v1/gate/staff-attendance').expect(403);

    // The gate's own totals count staff separately from students.
    const today = (await as(teacher).get('/api/v1/gate/today').expect(200)).body.data;
    expect(today).toMatchObject({ clockedIn: 0, staff: { clockedIn: 2, stillIn: 1, late: 1 } });
    expect(today.recent[0]).toMatchObject({ who: 'STAFF', action: 'OUT', name: 'Tunde Bakare' });
    // No student attendance is touched by a staff scan.
    expect(db.store.get('attendance')).toBeUndefined();
  });

  it('rejects a replaced staff card, and the card of someone who has left', async () => {
    const cards = await staffCards();
    const { qr } = (await as(owner).post('/api/v1/gate/staff-cards/T_t2/reissue').expect(201)).body.data;
    expect(qr).not.toBe(cards.T_t2.qr);
    await scan(cards.T_t2.qr).expect(404);
    await scan(qr).expect(201);
    await as(owner).post('/api/v1/gate/staff-cards/T_tb/reissue').expect(404); // another school's teacher
    await as(owner).post('/api/v1/gate/staff-cards/../reissue').expect(404);
    await as(teacher).post('/api/v1/gate/staff-cards/T_t1/reissue').expect(403);
    db.store.get('teachers')!.set('t1', { ...db.store.get('teachers')!.get('t1'), status: 'INACTIVE' });
    expect((await scan(cards.T_t1.qr).expect(400)).body.message).toMatch(/no longer works at the school/);
  });
});
