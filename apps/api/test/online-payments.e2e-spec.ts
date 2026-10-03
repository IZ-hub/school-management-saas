process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { currentTermSession } from '../src/common/school-date';
import { PaystackClient, PaystackTransaction } from '../src/modules/online-payments/paystack.client';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub: string, schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

const KEY = 'sk_test_' + 'a'.repeat(40);

/** Stands in for Paystack: remembers initialized payments; tests decide how each one ends. */
class FakePaystack {
  initialized: any[] = [];
  outcome = new Map<string, Partial<PaystackTransaction>>();
  async checkKey(key: string) {
    if (key.endsWith('bad')) throw new BadRequestException('Paystack did not accept this secret key.');
  }
  async initialize(key: string, body: any) {
    this.initialized.push({ key, ...body });
    return { authorizationUrl: `https://checkout.paystack.com/${body.reference}` };
  }
  async verify(_key: string, reference: string): Promise<PaystackTransaction> {
    const init = this.initialized.find((i) => i.reference === reference);
    return { status: 'success', reference, amount: init.amount, currency: 'NGN', paidAt: '2026-10-02T10:00:00Z', channel: 'card', metadata: init.metadata, ...this.outcome.get(reference) };
  }
}

describe('Online payments with Paystack (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  let paystack: FakePaystack;
  const ts = currentTermSession();
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    delete: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
  });
  const owner = as(token('SCHOOL_OWNER', 'owner-1'));
  const parent = as(token('PARENT', 'parent-1'));
  const payments = () => [...(db.store.get('feePayments')?.values() ?? [])];
  const signed = (body: object, key = KEY) => {
    const raw = JSON.stringify(body);
    return http.post('/api/v1/paystack/webhook/school-a').set('Content-Type', 'application/json').set('x-paystack-signature', crypto.createHmac('sha512', key).update(raw).digest('hex')).send(raw);
  };

  beforeEach(async () => {
    db = new FakeFirestore();
    paystack = new FakePaystack();
    db.seed('schools', 'school-a', { name: 'Greenfield Academy' });
    db.seed('users', 'owner-1', { schoolId: 'school-a', role: 'SCHOOL_OWNER', status: 'ACTIVE', email: 'owner@a.ng', firstName: 'Funke', lastName: 'Bello' });
    db.seed('users', 'parent-1', { schoolId: 'school-a', role: 'PARENT', status: 'ACTIVE', email: 'ngozi@mail.com', firstName: 'Ngozi', lastName: 'Okafor', childIds: ['s1'] });
    db.seed('users', 'parent-2', { schoolId: 'school-a', role: 'PARENT', status: 'ACTIVE', email: 'other@mail.com', firstName: 'Other', lastName: 'Parent', childIds: ['s2'] });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('students', 's1', { schoolId: 'school-a', firstName: 'Chioma', lastName: 'Okafor', admissionNumber: 'A/1', classId: 'jss1', status: 'ACTIVE' });
    db.seed('students', 's2', { schoolId: 'school-a', firstName: 'Tobi', lastName: 'Ade', admissionNumber: 'A/2', classId: 'jss1', status: 'ACTIVE' });
    db.seed('feeSchedules', `${ts.session.replace('/', '-')}__${ts.term}__jss1`, { schoolId: 'school-a', term: ts.term, session: ts.session, classId: 'jss1', items: [{ name: 'Tuition', amount: 90000 }], total: 90000, dueDate: null });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ firestore: db })
      .overrideProvider(PaystackClient).useValue(paystack)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  const connect = () => owner.put('/api/v1/online-payments/settings', { secretKey: KEY }).expect(200);

  it('stores the school’s key encrypted and never returns it', async () => {
    await owner.put('/api/v1/online-payments/settings', { secretKey: 'pk_test_abc' }).expect(400);
    await owner.put('/api/v1/online-payments/settings', { secretKey: 'sk_test_' + 'b'.repeat(30) + 'bad' }).expect(400);
    const s = (await connect()).body.data;
    expect(s).toEqual({ enabled: true, needsNewKey: false, mode: 'test', keyHint: '…aaaa', webhookUrl: expect.stringContaining('/paystack/webhook/school-a') });
    const stored = JSON.stringify(db.peek('schoolSecrets', 'school-a'));
    expect(stored).not.toContain(KEY);
    expect(JSON.stringify((await owner.get('/api/v1/school').expect(200)).body)).not.toContain('paystack');
    await as(token('ACCOUNTANT', 'acc-1')).put('/api/v1/online-payments/settings', { secretKey: KEY }).expect(403);
    await as(token('TEACHER', 't-1')).get('/api/v1/online-payments/settings').expect(403);
    // Damaged or foreign ciphertext is treated as "re-enter the key".
    db.peek('schoolSecrets', 'school-a')!.paystackSecretKey = 'v1.AAAA.BBBB.CCCC';
    expect((await owner.get('/api/v1/online-payments/settings').expect(200)).body.data).toMatchObject({ enabled: false, needsNewKey: true });
  });

  it('lets a parent pay part of the balance online and records it with a receipt', async () => {
    expect((await parent.get('/api/v1/parent/children/s1').expect(200)).body.data.onlinePayments).toBe(false);
    await parent.post('/api/v1/parent/children/s1/pay', { amount: 40000 }).expect(400);
    await connect();
    expect((await parent.get('/api/v1/parent/children/s1').expect(200)).body.data.onlinePayments).toBe(true);

    const start = (await parent.post('/api/v1/parent/children/s1/pay', { amount: 40000 }).set('Origin', 'http://localhost:5173').expect(201)).body.data;
    expect(start.authorizationUrl).toBe(`https://checkout.paystack.com/${start.reference}`);
    expect(paystack.initialized[0]).toMatchObject({ key: KEY, email: 'ngozi@mail.com', amount: 4_000_000, callback_url: 'http://localhost:5173/parent?child=s1', metadata: { schoolId: 'school-a', studentId: 's1' } });

    const v = (await parent.post('/api/v1/parent/payments/verify', { reference: start.reference }).expect(201)).body.data;
    expect(v).toMatchObject({ status: 'SUCCESS', amount: 40000, receiptNumber: expect.stringMatching(/^RCP-2026-\d{4}$/) });
    expect(payments()).toEqual([expect.objectContaining({ studentId: 's1', amount: 40000, method: 'ONLINE', reference: start.reference, recordedByName: 'Paystack (online)', note: 'Paid online by Ngozi Okafor' })]);
    // Returning again (or refreshing) doesn't record it twice.
    await parent.post('/api/v1/parent/payments/verify', { reference: start.reference }).expect(201);
    expect(payments()).toHaveLength(1);
    const st = (await parent.get('/api/v1/parent/children/s1/fees').expect(200)).body.data;
    expect(st).toMatchObject({ paid: 40000, balance: 50000 });
  });

  it('records a payment once even when the webhook and the parent’s return arrive together', async () => {
    await connect();
    const { reference } = (await parent.post('/api/v1/parent/children/s1/pay', { amount: 90000 }).expect(201)).body.data;
    const event = { event: 'charge.success', data: { reference } };
    await Promise.all([signed(event).expect(200), parent.post('/api/v1/parent/payments/verify', { reference }).expect(201), signed(event).expect(200)]);
    expect(payments()).toHaveLength(1);
    expect(db.peek('onlinePayments', reference)).toMatchObject({ status: 'SUCCESS' });
  });

  it('ignores webhooks with a wrong signature, and payments that don’t match', async () => {
    await connect();
    const { reference } = (await parent.post('/api/v1/parent/children/s1/pay', { amount: 50000 }).expect(201)).body.data;
    const bad = await signed({ event: 'charge.success', data: { reference } }, 'sk_test_someone_elses_key').expect(200);
    expect(bad.body).toEqual({ ok: false });
    await http.post('/api/v1/paystack/webhook/school-a').send({ event: 'charge.success', data: { reference } }).expect(200);
    expect(payments()).toHaveLength(0);

    // Paystack says a different amount was paid: held for review, nothing recorded.
    paystack.outcome.set(reference, { amount: 100 });
    expect((await parent.post('/api/v1/parent/payments/verify', { reference }).expect(201)).body.data.status).toBe('REVIEW');
    expect(payments()).toHaveLength(0);

    const second = (await parent.post('/api/v1/parent/children/s1/pay', { amount: 1000 }).expect(201)).body.data;
    paystack.outcome.set(second.reference, { status: 'abandoned' });
    expect((await parent.post('/api/v1/parent/payments/verify', { reference: second.reference }).expect(201)).body.data.status).toBe('PENDING');
    expect(payments()).toHaveLength(0);
  });

  it('keeps payments to the parent’s own children and the real balance', async () => {
    await connect();
    await parent.post('/api/v1/parent/children/s2/pay', { amount: 1000 }).expect(404);
    await parent.post('/api/v1/parent/children/s1/pay', { amount: 90001 }).expect(400);
    await parent.post('/api/v1/parent/children/s1/pay', { amount: 50 }).expect(400);
    const { reference } = (await parent.post('/api/v1/parent/children/s1/pay', { amount: 1000 }).expect(201)).body.data;
    await as(token('PARENT', 'parent-2')).post('/api/v1/parent/payments/verify', { reference }).expect(404);
    await owner.post('/api/v1/parent/children/s1/pay', { amount: 1000 }).expect(403);
    // Unknown origins are sent back to the live site, never somewhere else.
    await parent.post('/api/v1/parent/children/s1/pay', { amount: 1000 }).set('Origin', 'https://evil.example').expect(201);
    expect(paystack.initialized.at(-1).callback_url).toMatch(/^https:\/\/school-management-1f070\.web\.app\/parent/);
    const list = (await owner.get('/api/v1/online-payments').expect(200)).body.data;
    expect(list.map((x: any) => x.status)).toEqual(['PENDING', 'PENDING']);
  });
});
