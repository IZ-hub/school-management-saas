process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { currentTermSession, schoolToday } from '../src/common/school-date';
import { TermiiClient } from '../src/modules/messages/termii.client';
import { PaystackClient } from '../src/modules/online-payments/paystack.client';
import { normalisePhone, render, smsPages } from '../src/modules/messages/messages.service';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub: string, schoolId = 'school-a') => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);
const API_KEY = 'TL' + 'k'.repeat(30);

class FakeTermii {
  sent: { to: string; from: string; sms: string }[] = [];
  failFor = new Set<string>();
  async checkKey(key: string) {
    if (key.startsWith('bad')) throw new BadRequestException('Termii did not accept this API key.');
    return { balance: 5000, currency: 'NGN' };
  }
  async send(_key: string, from: string, to: string, sms: string) {
    if (this.failFor.has(to)) throw new Error('DND number');
    this.sent.push({ to, from, sms });
    return { messageId: `m${this.sent.length}` };
  }
}

describe('Messages to parents (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  let termii: FakeTermii;
  const ts = currentTermSession();
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    delete: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
  });
  const owner = as(token('SCHOOL_OWNER', 'owner-1'));
  const connect = () => owner.put('/api/v1/messages/sms-settings', { apiKey: API_KEY, senderId: 'Greenfield' }).expect(200);

  beforeEach(async () => {
    db = new FakeFirestore();
    termii = new FakeTermii();
    db.seed('schools', 'school-a', { name: 'Greenfield Academy' });
    db.seed('users', 'owner-1', { schoolId: 'school-a', role: 'SCHOOL_OWNER', status: 'ACTIVE', firstName: 'Funke', lastName: 'Bello' });
    db.seed('users', 'p1', { schoolId: 'school-a', role: 'PARENT', status: 'ACTIVE', firstName: 'Ngozi', lastName: 'Okafor', phone: '0803 111 2222', childIds: ['s1', 's2'] });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    const st = (id: string, first: string, classId: string, extra = {}) => db.seed('students', id, { schoolId: 'school-a', firstName: first, lastName: 'Okafor', classId, status: 'ACTIVE', ...extra });
    st('s1', 'Chioma', 'jss1');
    st('s2', 'Emeka', 'jss2');
    st('s3', 'Tobi', 'jss1', { parentPhone: '+234 805 999 0000' });
    st('s4', 'Ada', 'jss2'); // no phone, no parent account
    st('gone', 'Left', 'jss1', { status: 'INACTIVE', parentPhone: '08030000000' });
    db.seed('feeSchedules', `${ts.session.replace('/', '-')}__${ts.term}__jss1`, { schoolId: 'school-a', term: ts.term, session: ts.session, classId: 'jss1', items: [{ name: 'Tuition', amount: 50000 }], total: 50000 });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ firestore: db })
      .overrideProvider(TermiiClient).useValue(termii)
      .overrideProvider(PaystackClient).useValue({ checkKey: async () => undefined })
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

  it('normalises phones, counts SMS pages and fills merge fields', () => {
    expect(['0803 111 2222', '+234 805 999 0000', '8031112222', '12345', '', null].map(normalisePhone)).toEqual(['2348031112222', '2348059990000', '2348031112222', null, null, null]);
    expect([smsPages('a'.repeat(160)), smsPages('a'.repeat(161)), smsPages('a'.repeat(306)), smsPages('a'.repeat(307))]).toEqual([1, 2, 2, 3]);
    expect(render('Dear {Parent}, {student} ({class}) owes {balance}. {school}', { parent: 'Ngozi', student: 'Chioma', class: 'JSS1', balance: '₦5,000', school: 'GA' })).toBe('Dear Ngozi, Chioma (JSS1) owes ₦5,000. GA');
  });

  it('keeps the SMS key encrypted, and doesn’t disturb the Paystack key', async () => {
    await owner.put('/api/v1/messages/sms-settings', { apiKey: 'bad' + 'k'.repeat(30), senderId: 'Greenfield' }).expect(400);
    await owner.put('/api/v1/messages/sms-settings', { apiKey: API_KEY, senderId: 'Way too long sender' }).expect(400);
    await owner.put('/api/v1/online-payments/settings', { secretKey: 'sk_test_' + 'a'.repeat(40) }).expect(200);
    expect((await connect()).body.data).toMatchObject({ enabled: true, senderId: 'Greenfield', keyHint: '…kkkk', balance: 5000 });
    expect(JSON.stringify(db.peek('schoolSecrets', 'school-a'))).not.toContain(API_KEY);
    expect((await owner.get('/api/v1/online-payments/settings').expect(200)).body.data.enabled).toBe(true);
    await owner.delete('/api/v1/online-payments/settings').expect(200);
    expect((await owner.get('/api/v1/messages/sms-settings').expect(200)).body.data.enabled).toBe(true);
    await owner.delete('/api/v1/messages/sms-settings').expect(200);
    expect((await owner.get('/api/v1/messages/sms-settings').expect(200)).body.data.enabled).toBe(false);
  });

  it('previews and sends to everyone: SMS where there is a phone, and every parent page', async () => {
    const text = 'Dear {parent}, {student} in {class}: school resumes Monday. {school}';
    const pv = (await owner.post('/api/v1/messages/preview', { audience: 'ALL', text, sms: true }).expect(201)).body.data;
    expect(pv).toMatchObject({ students: 4, onParentPage: 2, withPhone: 3, withoutPhone: 1, smsAvailable: false, sample: 'Dear Ngozi, Chioma in JSS1: school resumes Monday. Greenfield Academy' });
    await owner.post('/api/v1/messages', { audience: 'ALL', text, sms: true }).expect(400); // SMS not set up yet
    await connect();
    termii.failFor.add('2348059990000');
    const res = (await owner.post('/api/v1/messages', { audience: 'ALL', text, sms: true }).expect(201)).body.data;
    expect(res.counts).toEqual({ students: 4, onParentPage: 2, sms: { sent: 2, failed: 1, skipped: 1 } });
    expect(termii.sent.map((m) => [m.to, m.from])).toEqual([['2348031112222', 'Greenfield'], ['2348031112222', 'Greenfield']]);
    expect(termii.sent.map((m) => m.sms).sort()).toEqual([
      'Dear Ngozi, Chioma in JSS1: school resumes Monday. Greenfield Academy',
      'Dear Ngozi, Emeka in JSS2: school resumes Monday. Greenfield Academy',
    ]);
    const problems = (await owner.get(`/api/v1/messages/${res.id}/problems`).expect(200)).body.data;
    expect(problems.map((p: any) => [p.studentName, p.status]).sort()).toEqual([['Ada Okafor', 'NO_PHONE'], ['Tobi Okafor', 'FAILED']]);
    const history = (await owner.get('/api/v1/messages').expect(200)).body.data;
    expect(history[0]).toMatchObject({ audience: 'ALL', byName: 'Funke Bello', sms: true });

    // The parent sees both children's messages on their page.
    const inbox = (await as(token('PARENT', 'p1')).get('/api/v1/parent/messages').expect(200)).body.data;
    expect(inbox.map((m: any) => m.studentName).sort()).toEqual(['Chioma Okafor', 'Emeka Okafor']);
  });

  it('targets classes, families who owe, and today’s absentees', async () => {
    expect((await owner.post('/api/v1/messages/preview', { audience: 'CLASSES', classIds: ['jss2'], text: 'Hi', sms: false }).expect(201)).body.data.students).toBe(2);
    await owner.post('/api/v1/messages/preview', { audience: 'CLASSES', classIds: [], text: 'Hi', sms: false }).expect(400);
    const owing = (await owner.post('/api/v1/messages/preview', { audience: 'OWING', text: '{student} owes {balance}', sms: false }).expect(201)).body.data;
    expect(owing).toMatchObject({ students: 2, sample: 'Chioma owes ₦50,000' });
    db.seed('attendance', 'a1', { schoolId: 'school-a', classId: 'jss1', studentId: 's3', date: schoolToday(), status: 'ABSENT' });
    db.seed('attendance', 'a2', { schoolId: 'school-a', classId: 'jss1', studentId: 's1', date: schoolToday(), status: 'PRESENT' });
    expect((await owner.post('/api/v1/messages/preview', { audience: 'ABSENT_TODAY', text: '{student} is absent today', sms: false }).expect(201)).body.data).toMatchObject({ students: 1, sample: 'Tobi is absent today' });
    // Parent-page-only sends need no SMS setup.
    const res = (await owner.post('/api/v1/messages', { audience: 'ABSENT_TODAY', text: '{student} is absent today', sms: false }).expect(201)).body.data;
    expect(res.counts.sms).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  it('lets accountants send fee reminders only, and keeps others out', async () => {
    const acc = as(token('ACCOUNTANT', 'acc-1'));
    await acc.post('/api/v1/messages/preview', { audience: 'OWING', text: 'Pay up', sms: false }).expect(201);
    await acc.post('/api/v1/messages/preview', { audience: 'ALL', text: 'Hi', sms: false }).expect(403);
    await acc.put('/api/v1/messages/sms-settings', { apiKey: API_KEY, senderId: 'Greenfield' }).expect(403);
    await as(token('TEACHER', 't-1')).post('/api/v1/messages/preview', { audience: 'ALL', text: 'Hi', sms: false }).expect(403);
    await as(token('PARENT', 'p1')).get('/api/v1/messages').expect(403);
    await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).post('/api/v1/messages/preview', { audience: 'CLASSES', classIds: ['jss1'], text: 'Hi', sms: false }).expect(400);
  });
});
