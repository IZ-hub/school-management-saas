process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { currentTermSession } from '../src/common/school-date';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Fees and payments (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    delete: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
  });
  const api = as(token('SCHOOL_OWNER'));
  const term = { term: 'FIRST', session: '2026/2027' };
  const q = '?term=FIRST&session=2026/2027';
  const items = [{ name: 'Tuition', amount: 85000 }, { name: 'PTA levy', amount: 5000 }, { name: 'Development levy', amount: 10000 }];
  const setFees = (body: object = {}) => api.post('/api/v1/fees/schedules', { ...term, classIds: ['jss1', 'jss2'], items, dueDate: '2026-09-30', ...body });
  const pay = (studentId: string, amount: number, extra: object = {}, t = api) =>
    t.post('/api/v1/payments', { studentId, ...term, amount, method: 'TRANSFER', paidOn: '2026-09-15', ...extra });

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('schools', 'school-a', { name: 'Greenfield Academy', address: '12 Palm Rd', phone: '0800' });
    db.seed('users', 'owner-1', { schoolId: 'school-a', firstName: 'Funke', lastName: 'Bello', email: 'f@a.ng' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    db.seed('classes', 'ss1', { schoolId: 'school-a', name: 'SS1', status: 'ACTIVE' });
    db.seed('classes', 'b-class', { schoolId: 'school-b', name: 'JSS1', status: 'ACTIVE' });
    const st = (id: string, first: string, last: string, classId: string, status = 'ACTIVE', schoolId = 'school-a') =>
      db.seed('students', id, { schoolId, firstName: first, lastName: last, admissionNumber: `A/${id}`, classId, status });
    st('s1', 'Chioma', 'Okafor', 'jss1');
    st('s2', 'Ade', 'Bello', 'jss1');
    st('s3', 'Musa', 'Ibrahim', 'jss2');
    st('s4', 'Zainab', 'Yusuf', 'ss1');
    st('gone', 'Left', 'School', 'jss1', 'INACTIVE');
    st('b1', 'Other', 'School', 'b-class', 'ACTIVE', 'school-b');

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

  it('works out the current term from the date', () => {
    expect(currentTermSession('2026-10-03')).toEqual({ term: 'FIRST', session: '2026/2027' });
    expect(currentTermSession('2027-02-10')).toEqual({ term: 'SECOND', session: '2026/2027' });
    expect(currentTermSession('2027-06-01')).toEqual({ term: 'THIRD', session: '2026/2027' });
  });

  it('sets fees for several classes at once and replaces them when saved again', async () => {
    expect((await setFees().expect(201)).body.data).toEqual({ saved: 2, total: 100000 });
    await setFees({ classIds: ['jss1'], items: [{ name: 'Tuition', amount: 90000 }] }).expect(201);
    const o = (await api.get(`/api/v1/fees/overview${q}`).expect(200)).body.data;
    expect(o.classes.map((c: any) => [c.name, c.perStudent, c.students, c.expected])).toEqual([
      ['JSS1', 90000, 2, 180000],
      ['JSS2', 100000, 1, 100000],
      ['SS1', null, 1, 0],
    ]);
    expect(o.totals).toMatchObject({ expected: 280000, collected: 0, outstanding: 280000, rate: 0, owing: 3 });
    expect(o.students.find((s: any) => s.id === 's4')).toMatchObject({ status: 'NO_FEES', balance: 0 });
  });

  it('rejects bad fee lists', async () => {
    await setFees({ items: [] }).expect(400);
    await setFees({ items: [{ name: 'Tuition', amount: 0 }] }).expect(400);
    await setFees({ items: [{ name: 'Tuition', amount: 100 }, { name: ' tuition ', amount: 5 }] }).expect(400);
    await setFees({ items: [{ name: 'Tuition', amount: 10.5 }] }).expect(400);
    await setFees({ items: [{ name: 'Tuition', amount: -5 }] }).expect(400);
    await setFees({ classIds: ['b-class'] }).expect(400);
    await setFees({ session: '2026/2028' }).expect(400);
    await setFees({ dueDate: '2026-02-30' }).expect(400);
    expect(db.store.get('feeSchedules')?.size ?? 0).toBe(0);
  });

  it('records part payments with numbered receipts and keeps balances right', async () => {
    await setFees().expect(201);
    const r1 = (await pay('s1', 60000, { reference: 'GTB 1234' }).expect(201)).body.data;
    expect(r1).toMatchObject({ receiptNumber: 'RCP-2026-0001', amount: 60000, due: 100000, paidToDate: 60000, balanceAfter: 40000, recordedByName: 'Funke Bello' });
    expect(r1.student).toMatchObject({ firstName: 'Chioma', className: 'JSS1' });
    const r2 = (await pay('s1', 40000, { method: 'CASH', paidOn: '2026-09-20' }).expect(201)).body.data;
    expect(r2).toMatchObject({ receiptNumber: 'RCP-2026-0002', balanceAfter: 0 });
    expect((await pay('s1', 1).expect(400)).body.message).toBe('Chioma Okafor has already paid in full for this term.');
    expect((await pay('s2', 100001).expect(400)).body.message).toBe('Ade Bello only owes ₦100,000 for this term.');
    await pay('s3', 10000).expect(201);

    const o = (await api.get(`/api/v1/fees/overview${q}`).expect(200)).body.data;
    expect(o.totals).toMatchObject({ expected: 300000, collected: 110000, outstanding: 190000, rate: 37, owing: 2, paidInFull: 1 });
    expect(o.students.map((s: any) => [s.lastName, s.balance, s.status])).toEqual([
      ['Bello', 100000, 'UNPAID'],
      ['Ibrahim', 90000, 'PART'],
      ['Okafor', 0, 'PAID'],
      ['Yusuf', 0, 'NO_FEES'],
    ]);
    const list = (await api.get(`/api/v1/payments${q}`).expect(200)).body.data;
    expect(list).toMatchObject({ total: 110000, count: 3, byMethod: { TRANSFER: 70000, CASH: 40000 } });
    expect(list.payments[0]).toMatchObject({ receiptNumber: 'RCP-2026-0002', studentName: 'Chioma Okafor', className: 'JSS1' });
  });

  it('rejects payments that are invalid, future-dated, or for classes without fees', async () => {
    await setFees().expect(201);
    await pay('s1', 0).expect(400);
    await pay('s1', 100.5).expect(400);
    await pay('s1', 100, { method: 'CRYPTO' }).expect(400);
    await pay('s1', 100, { paidOn: '2999-01-01' }).expect(400);
    expect((await pay('s4', 100).expect(400)).body.message).toBe("Fees for SS1 haven't been set for this term yet.");
    await pay('b1', 100).expect(404);
    await pay('s1', 100, { fake: true }).expect(400);
    expect(db.store.get('feePayments')?.size ?? 0).toBe(0);
  });

  it('voids payments instead of deleting them, and the balance comes back', async () => {
    await setFees().expect(201);
    const r = (await pay('s1', 30000).expect(201)).body.data;
    await api.post(`/api/v1/payments/${r.id}/void`, { reason: '' }).expect(400);
    const v = (await api.post(`/api/v1/payments/${r.id}/void`, { reason: 'Entered for the wrong student' }).expect(201)).body.data;
    expect(v).toMatchObject({ voided: true, voidReason: 'Entered for the wrong student' });
    await api.post(`/api/v1/payments/${r.id}/void`, { reason: 'again' }).expect(400);
    const st = (await api.get(`/api/v1/fees/statement/s1${q}`).expect(200)).body.data;
    expect(st).toMatchObject({ due: 100000, paid: 0, balance: 100000 });
    expect(st.payments).toHaveLength(1);
    // The next receipt still gets a new number.
    expect((await pay('s1', 5000).expect(201)).body.data.receiptNumber).toBe('RCP-2026-0002');
  });

  it('applies discounts and shows them on the statement', async () => {
    await setFees().expect(201);
    await pay('s2', 80000).expect(201);
    expect((await api.put('/api/v1/fees/discounts', { ...term, studentId: 's2', amount: 30000 }).expect(400)).body.message).toMatch(/at most ₦20,000/);
    await api.put('/api/v1/fees/discounts', { ...term, studentId: 's2', amount: 15000, reason: 'Sibling discount' }).expect(200);
    const st = (await api.get(`/api/v1/fees/statement/s2${q}`).expect(200)).body.data;
    expect(st).toMatchObject({ fees: 100000, discount: { amount: 15000, reason: 'Sibling discount' }, due: 85000, paid: 80000, balance: 5000 });
    expect(st.items.map((i: any) => i.name)).toEqual(['Tuition', 'PTA levy', 'Development levy']);
    await api.put('/api/v1/fees/discounts', { ...term, studentId: 's2', amount: 0 }).expect(200);
    expect((await api.get(`/api/v1/fees/statement/s2${q}`).expect(200)).body.data.balance).toBe(20000);
    await api.put('/api/v1/fees/discounts', { ...term, studentId: 's4', amount: 100 }).expect(400);
  });

  it('only removes a class’s fees when nothing has been paid against them', async () => {
    await setFees().expect(201);
    await pay('s1', 1000).expect(201);
    const o = (await api.get(`/api/v1/fees/overview${q}`).expect(200)).body.data;
    const jss1 = o.classes.find((c: any) => c.name === 'JSS1');
    const jss2 = o.classes.find((c: any) => c.name === 'JSS2');
    await api.delete(`/api/v1/fees/schedules/${jss1.scheduleId}`).expect(400);
    await api.delete(`/api/v1/fees/schedules/${jss2.scheduleId}`).expect(200);
  });

  it('shows the term’s collection on the dashboard to finance roles only', async () => {
    const t = currentTermSession();
    await api.post('/api/v1/fees/schedules', { ...t, classIds: ['jss1'], items }).expect(201);
    const owner = (await api.get('/api/v1/dashboard/stats').expect(200)).body.data;
    expect(owner.feesTerm).toMatchObject({ ...t, expected: 200000, collected: 0, outstanding: 200000, rate: 0, feesSet: true });
    const teacher = (await as(token('TEACHER', 't-1')).get('/api/v1/dashboard/stats').expect(200)).body.data;
    expect(teacher.feesTerm).toBeNull();
  });

  it('lets accountants manage fees but not teachers or parents, and keeps schools apart', async () => {
    const acc = as(token('ACCOUNTANT', 'acc-1'));
    await acc.post('/api/v1/fees/schedules', { ...term, classIds: ['jss1'], items }).expect(201);
    await pay('s1', 500, {}, acc).expect(201);
    await as(token('TEACHER', 't-1')).get(`/api/v1/fees/overview${q}`).expect(403);
    await pay('s1', 500, {}, as(token('TEACHER', 't-1'))).expect(403);
    await as(token('PARENT', 'p-1')).get(`/api/v1/payments${q}`).expect(403);
    const b = as(token('SCHOOL_OWNER', 'o-b', 'school-b'));
    await b.get(`/api/v1/fees/statement/s1${q}`).expect(404);
    const pid = [...db.store.get('feePayments')!.keys()][0];
    await b.get(`/api/v1/payments/${pid}`).expect(404);
    await b.post(`/api/v1/payments/${pid}/void`, { reason: 'x' }).expect(404);
    expect((await b.get(`/api/v1/payments${q}`).expect(200)).body.data.count).toBe(0);
  });
});
