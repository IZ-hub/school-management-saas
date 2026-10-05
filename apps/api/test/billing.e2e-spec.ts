process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { schoolToday } from '../src/common/school-date';
import { TermCalendar } from '../src/common/term-calendar';
import { billingState } from '../src/common/billing';
import { PaystackClient } from '../src/modules/online-payments/paystack.client';
import { forgetBilling } from '../src/modules/auth/guards/jwt-auth.guard';
import { FakeFirestore } from './fake-firestore';

const PLATFORM_KEY = 'sk_test_' + 'p'.repeat(40);
const token = (role: string, sub: string, schoolId = 'school-a') => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

class FakePaystack {
  initialized: any[] = [];
  async initialize(key: string, body: any) { this.initialized.push({ key, ...body }); return { authorizationUrl: `https://checkout.paystack.com/${body.reference}` }; }
  async verify(_k: string, reference: string) {
    const i = this.initialized.find((x) => x.reference === reference);
    return { status: 'success', reference, amount: i.amount, currency: 'NGN', paidAt: new Date().toISOString(), channel: 'card', metadata: i.metadata };
  }
  async checkKey() {}
}

describe('SchoolBricks billing (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  let paystack: FakePaystack;
  const owner = token('SCHOOL_OWNER', 'owner');
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const addStudent = (t = owner) => as(t).post('/api/v1/students', { firstName: 'New', lastName: 'Pupil', dateOfBirth: '2015-01-01', gender: 'MALE', admissionNumber: `N${Date.now()}${Math.random()}`, classId: 'jss1' });

  const boot = async (trialEndsOn: string | null, students = 3) => {
    db = new FakeFirestore();
    paystack = new FakePaystack();
    forgetBilling('school-a'); // each test is a fresh school
    db.seed('schools', 'school-a', { name: 'Greenfield', createdAt: new Date('2026-01-10'), ...(trialEndsOn ? { billing: { trialEndsOn } } : {}) });
    db.seed('users', 'owner', { schoolId: 'school-a', role: 'SCHOOL_OWNER', status: 'ACTIVE', email: 'owner@a.ng' });
    db.seed('users', 'parent', { schoolId: 'school-a', role: 'PARENT', status: 'ACTIVE', email: 'p@a.ng', childIds: ['s0'] });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    for (let i = 0; i < students; i++) db.seed('students', `s${i}`, { schoolId: 'school-a', firstName: `S${i}`, lastName: 'X', classId: 'jss1', status: 'ACTIVE' });
    db.seed('students', 'gone', { schoolId: 'school-a', firstName: 'Left', lastName: 'X', classId: 'jss1', status: 'INACTIVE' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ firestore: db })
      .overrideProvider(PaystackClient).useValue(paystack)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  };

  beforeEach(() => { process.env.PLATFORM_PAYSTACK_SECRET_KEY = PLATFORM_KEY; });
  afterEach(async () => { await app?.close(); delete process.env.PLATFORM_PAYSTACK_SECRET_KEY; });

  it('works out trial, due, grace and read-only from the school calendar', () => {
    const cal = new TermCalendar([
      { session: '2026/2027', term: 'FIRST', start: '2026-09-14', end: '2026-12-18' },
      { session: '2026/2027', term: 'SECOND', start: '2027-01-11', end: '2027-04-09' },
    ]);
    const school = { billing: { trialEndsOn: '2026-10-19' } };
    expect(billingState(school, cal, false, '2026-10-10')).toMatchObject({ status: 'TRIAL', dueOn: '2026-10-19' });
    expect(billingState(school, cal, false, '2026-10-22')).toMatchObject({ status: 'DUE', dueOn: '2026-10-19', readOnlyFrom: '2026-10-26' });
    expect(billingState(school, cal, false, '2026-10-26')).toMatchObject({ status: 'READ_ONLY' });
    expect(billingState(school, cal, true, '2026-10-26')).toMatchObject({ status: 'ACTIVE' });
    // Christmas holiday still counts as First Term (paid); Second Term is due when it starts.
    expect(billingState(school, cal, true, '2026-12-28')).toMatchObject({ status: 'ACTIVE', term: { term: 'FIRST' } });
    expect(billingState(school, cal, false, '2027-01-13')).toMatchObject({ status: 'DUE', dueOn: '2027-01-11', readOnlyFrom: '2027-01-18' });
    // Schools that existed before billing began get 14 days from launch.
    expect(billingState({ createdAt: new Date('2025-05-01') }, cal, false, '2026-10-06')).toMatchObject({ status: 'TRIAL', trialEndsOn: '2026-10-19' });
  });

  it('gives new schools a 14-day trial', async () => {
    await boot(null);
    const reg = await http.post('/api/v1/schools/register').send({ schoolName: 'New School', schoolEmail: 'n@s.ng', phone: '0800', ownerFirstName: 'A', ownerLastName: 'B', ownerEmail: 'new@s.ng', ownerPassword: 'password-123' }).expect(201);
    const st = (await as(reg.body.data.accessToken).get('/api/v1/billing/status').expect(200)).body.data;
    expect(st).toMatchObject({ status: 'TRIAL', students: 0, pricePerStudent: 1500, paymentsEnabled: true });
    expect(st.trialEndsOn).toBe(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  });

  it('shows an invoice for active students when due, and keeps working through the grace period', async () => {
    await boot(daysAgo(2));
    const o = (await as(owner).get('/api/v1/billing').expect(200)).body.data;
    expect(o).toMatchObject({ status: 'DUE', students: 3, estimate: 4500 });
    expect(o.invoice).toMatchObject({ students: 3, amount: 4500, status: 'OPEN' });
    await addStudent().expect(201); // still allowed during grace
  });

  it('becomes read-only after grace, then pays and unlocks at once', async () => {
    await boot('2026-01-01');
    expect((await as(owner).get('/api/v1/billing/status').expect(200)).body.data.status).toBe('READ_ONLY');
    const blocked = await addStudent().expect(402);
    expect(blocked.body.message).toMatch(/read-only/);
    await as(owner).get('/api/v1/students').expect(200); // viewing still works
    await as(token('TEACHER', 't')).get('/api/v1/billing').expect(403); // only admins pay

    const { reference, authorizationUrl } = (await as(owner).post('/api/v1/billing/pay').set('Origin', 'http://localhost:5173').expect(201)).body.data;
    expect(authorizationUrl).toContain(reference);
    expect(paystack.initialized[0]).toMatchObject({ key: PLATFORM_KEY, email: 'owner@a.ng', amount: 450_000, callback_url: 'http://localhost:5173/billing' });
    expect((await as(owner).post('/api/v1/billing/verify', { reference }).expect(201)).body.data.status).toBe('SUCCESS');
    expect((await as(owner).get('/api/v1/billing/status').expect(200)).body.data.status).toBe('ACTIVE');
    await addStudent().expect(201);
    await as(owner).post('/api/v1/billing/pay').expect(400); // already paid
    const history = (await as(owner).get('/api/v1/billing').expect(200)).body.data.history;
    expect(history).toEqual([expect.objectContaining({ amount: 4500, status: 'PAID' })]);
  });

  it('records a payment once from the signed webhook, and ignores forged ones', async () => {
    await boot('2026-01-01');
    const { reference } = (await as(owner).post('/api/v1/billing/pay').expect(201)).body.data;
    const send = (key: string) => {
      const raw = JSON.stringify({ event: 'charge.success', data: { reference } });
      return http.post('/api/v1/billing-webhook/paystack').set('Content-Type', 'application/json')
        .set('x-paystack-signature', crypto.createHmac('sha512', key).update(raw).digest('hex')).send(raw).expect(200);
    };
    expect((await send('sk_test_wrong')).body).toEqual({ ok: false });
    expect((await as(owner).get('/api/v1/billing/status')).body.data.status).toBe('READ_ONLY');
    await Promise.all([send(PLATFORM_KEY), send(PLATFORM_KEY)]);
    expect((await as(owner).get('/api/v1/billing/status')).body.data.status).toBe('ACTIVE');
  });

  it('never locks a school when SchoolBricks payments are not set up, or when there is nothing to pay', async () => {
    delete process.env.PLATFORM_PAYSTACK_SECRET_KEY;
    await boot('2026-01-01');
    expect((await as(owner).get('/api/v1/billing/status')).body.data).toMatchObject({ status: 'READ_ONLY', enforced: false, paymentsEnabled: false });
    await addStudent().expect(201);
    await as(owner).post('/api/v1/billing/pay').expect(400);
    await app.close();

    process.env.PLATFORM_PAYSTACK_SECRET_KEY = PLATFORM_KEY;
    await boot('2026-01-01', 0);
    db.store.get('students')!.clear();
    const o = (await as(owner).get('/api/v1/billing').expect(200)).body.data;
    expect(o.invoice).toMatchObject({ amount: 0, status: 'PAID' });
    expect((await as(owner).get('/api/v1/billing/status')).body.data.status).toBe('ACTIVE');
  });

  it('lets parents keep viewing and paying school fees while the school is read-only', async () => {
    await boot('2026-01-01');
    const parent = token('PARENT', 'parent');
    await as(parent).get('/api/v1/parent/children/s0').expect(200);
    // The parent payment route is allowed through (it then fails for its own reason: no Paystack set up by the school).
    expect((await as(parent).post('/api/v1/parent/children/s0/pay', { amount: 1000 })).status).not.toBe(402);
    expect(schoolToday()).toBeTruthy();
  });
});
