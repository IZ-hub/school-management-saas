process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

describe('Password resets, login lockout and instant sign-out (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const sent: { to: string; subject: string; text: string }[] = [];
  const realFetch = global.fetch;

  beforeAll(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    // Capture outgoing email instead of calling Resend.
    global.fetch = (async (url: any, init: any) => {
      if (String(url).startsWith('https://api.resend.com')) {
        const b = JSON.parse(init.body);
        sent.push({ to: b.to[0], subject: b.subject, text: b.text });
        return new Response('{"id":"e1"}', { status: 200 });
      }
      return realFetch(url, init);
    }) as typeof fetch;
  });
  afterAll(() => {
    global.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  });

  beforeEach(async () => {
    sent.length = 0;
    db = new FakeFirestore();
    const hash = await bcrypt.hash('right-password', 4);
    db.seed('schools', 'school-a', { name: 'Greenfield Academy' });
    db.seed('users', 'owner-1', { schoolId: 'school-a', email: 'owner@a.ng', password: hash, role: 'SCHOOL_OWNER', status: 'ACTIVE', firstName: 'Funke', lastName: 'Bello' });
    db.seed('users', 'teacher-1', { schoolId: 'school-a', email: 'ade@a.ng', password: hash, role: 'TEACHER', status: 'ACTIVE', firstName: 'Ade', lastName: 'Musa', teacherId: null });
    db.seed('users', 'parent-1', { schoolId: 'school-a', email: 'mum@mail.com', password: hash, role: 'PARENT', status: 'ACTIVE', firstName: 'Ngozi', lastName: 'Eze', childIds: [] });
    db.seed('users', 'invited-1', { schoolId: 'school-a', email: 'new@a.ng', password: null, role: 'TEACHER', status: 'INVITED', firstName: 'New', lastName: 'Teacher' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FirebaseService).useValue({ firestore: db }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (email: string, password: string, ip = '10.0.0.1') => http.post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password });
  const tokenFor = async (email: string) => (await login(email, 'right-password').expect(201)).body.data.accessToken as string;
  const codeFrom = (text: string) => decodeURIComponent(text.match(/\/reset#(\S+)/)![1]);

  it('emails a one-hour reset link that sets a new password and signs out other devices', async () => {
    const before = await tokenFor('owner@a.ng');
    const res = await http.post('/api/v1/auth/forgot-password').set('Origin', 'http://localhost:5173').send({ email: 'Owner@A.ng' }).expect(200);
    expect(res.body.data).toEqual({ sent: true, emailEnabled: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'owner@a.ng', subject: 'Reset your Schoolful LMS password' });
    expect(sent[0].text).toContain('http://localhost:5173/reset#');
    const code = codeFrom(sent[0].text);
    expect((await http.get(`/api/v1/auth/invite?code=${encodeURIComponent(code)}`).expect(200)).body.data).toMatchObject({ purpose: 'RESET', email: 'owner@a.ng' });
    expect(Object.keys(Object.fromEntries(db.store.get('refreshTokens') ?? new Map())).length).toBeGreaterThan(0);
    await http.post('/api/v1/auth/accept-invite').send({ code, password: 'brand-new-pass' }).expect(201);
    // Other sessions were revoked, the old password no longer works, the new one does.
    expect([...(db.store.get('refreshTokens')?.values() ?? [])].length).toBe(1);
    await login('owner@a.ng', 'right-password').expect(401);
    await login('owner@a.ng', 'brand-new-pass').expect(201);
    await http.post('/api/v1/auth/accept-invite').send({ code, password: 'again-pass-1' }).expect(400);
    void before;
  });

  it('answers the same for unknown emails and limits repeated requests', async () => {
    expect((await http.post('/api/v1/auth/forgot-password').send({ email: 'nobody@x.ng' }).expect(200)).body.data.sent).toBe(true);
    expect(sent).toHaveLength(0);
    // Invited accounts must use their setup link, not a reset.
    await http.post('/api/v1/auth/forgot-password').send({ email: 'new@a.ng' }).expect(200);
    expect(sent).toHaveLength(0);
    for (let i = 0; i < 5; i++) await http.post('/api/v1/auth/forgot-password').send({ email: 'mum@mail.com' }).expect(200);
    expect(sent).toHaveLength(3); // capped at 3 an hour
  });

  it('locks sign-in for an email after 5 wrong passwords, and for a network after 30', async () => {
    for (let i = 0; i < 5; i++) await login('ade@a.ng', 'wrong').expect(401);
    const locked = await login('ade@a.ng', 'right-password').expect(429);
    expect(locked.body.message).toMatch(/Too many wrong attempts\. Wait \d+ minutes/);
    // Other people aren't affected.
    await login('mum@mail.com', 'right-password', '10.0.0.2').expect(201);
    // A successful sign-in clears an email's earlier failures.
    for (let i = 0; i < 4; i++) await login('mum@mail.com', 'wrong', '10.0.0.3').expect(401);
    await login('mum@mail.com', 'right-password', '10.0.0.3').expect(201);
    await login('mum@mail.com', 'wrong', '10.0.0.3').expect(401);
    await login('mum@mail.com', 'right-password', '10.0.0.3').expect(201);
    for (let i = 0; i < 30; i++) await login(`guess${i}@x.ng`, 'wrong', '10.9.9.9').expect(401);
    expect((await login('owner@a.ng', 'right-password', '10.9.9.9').expect(429)).body.message).toMatch(/from this network/);
  });

  it('lets admins create reset links for staff and parents', async () => {
    const owner = await tokenFor('owner@a.ng');
    const staffLink = (await http.post('/api/v1/staff/teacher-1/reset-link').set('Authorization', `Bearer ${owner}`).expect(201)).body.data;
    expect(staffLink).toMatchObject({ purpose: 'RESET', email: 'ade@a.ng' });
    await http.post('/api/v1/staff/invited-1/reset-link').set('Authorization', `Bearer ${owner}`).expect(400);
    await http.post('/api/v1/staff/owner-1/reset-link').set('Authorization', `Bearer ${owner}`).expect(400); // not your own here
    const parentLink = (await http.post('/api/v1/parent-access/parent-1/reset-link').set('Authorization', `Bearer ${owner}`).expect(201)).body.data;
    await http.post('/api/v1/auth/accept-invite').send({ code: parentLink.code, password: 'parent-new-pass' }).expect(201);
    await login('mum@mail.com', 'parent-new-pass').expect(201);
    const teacher = await tokenFor('ade@a.ng');
    await http.post('/api/v1/parent-access/parent-1/reset-link').set('Authorization', `Bearer ${teacher}`).expect(403);
    void staffLink;
  });

  it('refuses a switched-off account or changed role at once, not after 15 minutes', async () => {
    const owner = await tokenFor('owner@a.ng');
    const teacher = await tokenFor('ade@a.ng');
    await http.get('/api/v1/classes').set('Authorization', `Bearer ${teacher}`).expect(200);
    await http.post('/api/v1/staff/teacher-1/disable').set('Authorization', `Bearer ${owner}`).expect(201);
    expect((await http.get('/api/v1/classes').set('Authorization', `Bearer ${teacher}`).expect(401)).body.message).toBe('Your account has changed. Please sign in again.');
    await http.post('/api/v1/staff/teacher-1/enable').set('Authorization', `Bearer ${owner}`).expect(201);
    const again = await tokenFor('ade@a.ng');
    await http.patch('/api/v1/staff/teacher-1/role').set('Authorization', `Bearer ${owner}`).send({ role: 'ACCOUNTANT' }).expect(200);
    await http.get('/api/v1/classes').set('Authorization', `Bearer ${again}`).expect(401);
    const asAccountant = await tokenFor('ade@a.ng');
    await http.get('/api/v1/fees/overview').set('Authorization', `Bearer ${asAccountant}`).expect(200);
  });
});
