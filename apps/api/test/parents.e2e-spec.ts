process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { currentTermSession, schoolToday } from '../src/common/school-date';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Parent access (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
    delete: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
  });
  const admin = as(token('SCHOOL_OWNER'));
  const ts = currentTermSession();
  const invite = (studentId = 's1', email = 'Ngozi.Okafor@Mail.com', t = admin) =>
    t.post('/api/v1/parent-access/invite', { studentId, email, firstName: 'Ngozi', lastName: 'Okafor', phone: '0803 111 2222' });
  /** Accepts an invite and returns the parent's access token. */
  const accept = async (code: string, password = 'secret-pass-1') =>
    (await http.post('/api/v1/auth/accept-invite').send({ code, password }).expect(201)).body.data.accessToken as string;

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('schools', 'school-a', { name: 'Greenfield Academy' });
    db.seed('users', 'owner-1', { schoolId: 'school-a', email: 'owner@a.ng', role: 'SCHOOL_OWNER', status: 'ACTIVE', firstName: 'Funke', lastName: 'Bello' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    const st = (id: string, first: string, classId: string, schoolId = 'school-a', status = 'ACTIVE') =>
      db.seed('students', id, { schoolId, firstName: first, lastName: 'Okafor', admissionNumber: `A/${id}`, classId, status });
    st('s1', 'Chioma', 'jss1');
    st('s2', 'Emeka', 'jss1');
    st('s3', 'Someone', 'jss1');
    st('b1', 'Other', 'b-class', 'school-b');
    db.seed('examSeries', 'ser1', { schoolId: 'school-a', name: 'First Term Examination', term: ts.term, session: ts.session, classIds: ['jss1'], startDate: '2026-12-01', endDate: '2026-12-11' });
    db.seed('exams', 'ser1__jss1__maths', { schoolId: 'school-a', seriesId: 'ser1', classId: 'jss1', subjectId: 'maths', title: 'Mathematics', maxScore: 60 });
    db.seed('examResults', 'r1', { schoolId: 'school-a', seriesId: 'ser1', examId: 'ser1__jss1__maths', classId: 'jss1', studentId: 's1', ca: 30, exam: 50, score: 80, grade: 'A' });
    db.seed('examResults', 'r3', { schoolId: 'school-a', seriesId: 'ser1', examId: 'ser1__jss1__maths', classId: 'jss1', studentId: 's3', ca: 20, exam: 30, score: 50, grade: 'C' });
    db.seed('attendance', 'a1', { schoolId: 'school-a', classId: 'jss1', studentId: 's1', date: schoolToday(), status: 'PRESENT' });
    db.seed('attendance', 'a2', { schoolId: 'school-a', classId: 'jss1', studentId: 's1', date: `${schoolToday().slice(0, 8)}01`, status: 'ABSENT' });
    db.seed('feeSchedules', `${ts.session.replace('/', '-')}__${ts.term}__jss1`, { schoolId: 'school-a', term: ts.term, session: ts.session, classId: 'jss1', items: [{ name: 'Tuition', amount: 50000 }], total: 50000, dueDate: null });

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

  it('invites a parent with a one-time link, and they set a password and sign in', async () => {
    const inv = (await invite().expect(201)).body.data;
    expect(inv).toMatchObject({ status: 'INVITED', email: 'ngozi.okafor@mail.com' });
    const user = db.peek('users', inv.userId)!;
    expect(user).toMatchObject({ role: 'PARENT', status: 'INVITED', password: null, childIds: ['s1'] });
    // Only a hash of the secret is stored.
    expect(JSON.stringify([...db.store.get('invites')!.values()])).not.toContain(inv.code.split('.')[1]);

    // Can't log in before setting a password.
    const early = await http.post('/api/v1/auth/login').send({ email: 'ngozi.okafor@mail.com', password: 'anything' }).expect(401);
    expect(early.body.message).toMatch(/Finish setting up/);

    const info = (await http.get(`/api/v1/auth/invite?code=${encodeURIComponent(inv.code)}`).expect(200)).body.data;
    expect(info).toEqual({ email: 'ngozi.okafor@mail.com', firstName: 'Ngozi', role: 'PARENT', purpose: 'SETUP', schoolName: 'Greenfield Academy', children: ['Chioma'] });
    await http.post('/api/v1/auth/accept-invite').send({ code: inv.code, password: 'short' }).expect(400);
    const accessToken = await accept(inv.code);
    expect(jwt.decode(accessToken)).toMatchObject({ role: 'PARENT', schoolId: 'school-a' });
    // The link only works once.
    await http.get(`/api/v1/auth/invite?code=${encodeURIComponent(inv.code)}`).expect(400);
    await http.post('/api/v1/auth/accept-invite').send({ code: inv.code, password: 'another-pass' }).expect(400);
    // Normal login works, whatever the email's capitals.
    await http.post('/api/v1/auth/login').send({ email: 'Ngozi.Okafor@Mail.com', password: 'secret-pass-1' }).expect(201);
  });

  it('rejects tampered, expired and replaced links', async () => {
    const inv = (await invite().expect(201)).body.data;
    const [id] = inv.code.split('.');
    await http.get(`/api/v1/auth/invite?code=${id}.wrongsecret`).expect(400);
    await http.get('/api/v1/auth/invite?code=nonsense').expect(400);
    const again = (await admin.post(`/api/v1/parent-access/${inv.userId}/resend`).expect(201)).body.data;
    await http.get(`/api/v1/auth/invite?code=${encodeURIComponent(inv.code)}`).expect(400);
    const [newId] = again.code.split('.');
    db.store.get('invites')!.get(newId)!.expiresAt = new Date(Date.now() - 1000);
    await http.get(`/api/v1/auth/invite?code=${encodeURIComponent(again.code)}`).expect(400);
  });

  it('adds siblings to the same parent account, and refuses staff emails', async () => {
    const first = (await invite('s1').expect(201)).body.data;
    await accept(first.code);
    const second = (await invite('s2').expect(201)).body.data;
    expect(second).toMatchObject({ status: 'LINKED', userId: first.userId });
    expect(db.peek('users', first.userId)!.childIds).toEqual(['s1', 's2']);
    expect((await invite('s1', 'owner@a.ng').expect(400)).body.message).toMatch(/staff account/);
    await invite('b1').expect(404);
    const list = (await admin.get('/api/v1/parent-access?studentId=s2').expect(200)).body.data;
    expect(list).toEqual([expect.objectContaining({ email: 'ngozi.okafor@mail.com', status: 'ACTIVE', children: 2 })]);
  });

  it('shows a parent only their own children, with attendance, fees and published report cards', async () => {
    const inv = (await invite('s1').expect(201)).body.data;
    const parent = as(await accept(inv.code));
    const kids = (await parent.get('/api/v1/parent/children').expect(200)).body.data;
    expect(kids).toEqual({ schoolName: 'Greenfield Academy', schoolLogo: null, children: [{ id: 's1', firstName: 'Chioma', lastName: 'Okafor', admissionNumber: 'A/s1', className: 'JSS1' }] });

    const o = (await parent.get('/api/v1/parent/children/s1').expect(200)).body.data;
    expect(o.fees).toMatchObject({ due: 50000, paid: 0, balance: 50000 });
    expect(o.attendance.present).toBe(1);
    expect(o.reportCards).toEqual([]);

    // Not published yet.
    await parent.get('/api/v1/parent/children/s1/report-card?seriesId=ser1').expect(404);
    await admin.patch('/api/v1/exam-series/ser1/publish', { published: true }).expect(200);
    expect((await parent.get('/api/v1/parent/children/s1').expect(200)).body.data.reportCards).toEqual([expect.objectContaining({ seriesId: 'ser1' })]);
    const rc = (await parent.get('/api/v1/parent/children/s1/report-card?seriesId=ser1').expect(200)).body.data;
    expect(rc.card).toMatchObject({ average: 80, position: 1 });
    expect(rc.cards).toBeUndefined();
    expect(JSON.stringify(rc)).not.toContain('Someone');

    // Other children, other schools and staff areas are off limits.
    await parent.get('/api/v1/parent/children/s3').expect(404);
    await parent.get('/api/v1/parent/children/s3/report-card?seriesId=ser1').expect(404);
    await parent.get('/api/v1/parent/children/s3/fees').expect(404);
    await parent.get('/api/v1/parent/children/b1').expect(404);
    await parent.get('/api/v1/students').expect(403);
    await parent.get('/api/v1/report-cards?seriesId=ser1&classId=jss1').expect(403);
    await parent.get('/api/v1/fees/overview').expect(403);
    await as(token('TEACHER', 't-1')).get('/api/v1/parent/children').expect(403);
  });

  it('cuts access straight away when a child is unlinked', async () => {
    const inv = (await invite('s1').expect(201)).body.data;
    const parent = as(await accept(inv.code));
    await parent.get('/api/v1/parent/children/s1').expect(200);
    await admin.delete(`/api/v1/parent-access/${inv.userId}/children/s1`).expect(200);
    expect(db.peek('users', inv.userId)!.status).toBe('DISABLED');
    // Refused at once, not when their 15-minute token runs out.
    await parent.get('/api/v1/parent/children/s1').expect(401);
    await http.post('/api/v1/auth/login').send({ email: 'ngozi.okafor@mail.com', password: 'secret-pass-1' }).expect(401);
  });

  it('only lets admins manage parent access and publish results', async () => {
    const teacher = as(token('TEACHER', 't-1'));
    await invite('s1', 'x@y.ng', teacher).expect(403);
    await as(token('ACCOUNTANT', 'a-1')).get('/api/v1/parent-access?studentId=s1').expect(403);
    await teacher.patch('/api/v1/exam-series/ser1/publish', { published: true }).expect(403);
    await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).get('/api/v1/parent-access?studentId=s1').expect(404);
  });
});
