process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { suggestNext } from '../src/modules/promotion/promotion.service';
import { TermCalendar } from '../src/common/term-calendar';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Staff accounts, promotion and school settings (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const owner = as(token('SCHOOL_OWNER'));
  const principal = as(token('PRINCIPAL', 'prin-1'));
  const student = (id: string) => db.peek('students', id)!;

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('schools', 'school-a', { name: 'Greenfield Academy', address: '12 Palm Rd' });
    db.seed('users', 'owner-1', { schoolId: 'school-a', email: 'owner@a.ng', role: 'SCHOOL_OWNER', status: 'ACTIVE', firstName: 'Funke', lastName: 'Bello', password: 'x' });
    db.seed('users', 'prin-1', { schoolId: 'school-a', email: 'principal@a.ng', role: 'PRINCIPAL', status: 'ACTIVE', firstName: 'Kunle', lastName: 'Ade', password: 'x' });
    db.seed('users', 'parent-1', { schoolId: 'school-a', email: 'mum@mail.com', role: 'PARENT', status: 'ACTIVE', firstName: 'Ngozi', lastName: 'Eze', childIds: [] });
    db.seed('teachers', 't1', { schoolId: 'school-a', firstName: 'Tunde', lastName: 'Bakare', email: 'tunde@a.ng' });
    for (const [id, name] of [['p6', 'Primary 6'], ['jss1', 'JSS 1'], ['jss2', 'JSS2'], ['jss3', 'JSS3'], ['ss1', 'SS1'], ['ss3', 'SS3']]) {
      db.seed('classes', id, { schoolId: 'school-a', name, status: 'ACTIVE' });
    }
    const st = (id: string, classId: string) => db.seed('students', id, { schoolId: 'school-a', firstName: id, lastName: 'Okafor', admissionNumber: `A/${id}`, classId, status: 'ACTIVE' });
    st('a', 'jss1'); st('b', 'jss1'); st('c', 'jss2'); st('d', 'jss3'); st('e', 'ss3'); st('f', 'p6');

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

  describe('staff accounts', () => {
    const invite = (body: object, t = owner) => t.post('/api/v1/staff/invite', { email: 'Tunde@A.ng', firstName: 'Tunde', lastName: 'Bakare', role: 'TEACHER', ...body });

    it('invites a teacher who sets a password and signs in with the teacher role', async () => {
      const inv = (await invite({ teacherId: 't1' }).expect(201)).body.data;
      expect(db.peek('users', inv.userId)).toMatchObject({ email: 'tunde@a.ng', role: 'TEACHER', status: 'INVITED', teacherId: 't1' });
      const info = (await http.get(`/api/v1/auth/invite?code=${encodeURIComponent(inv.code)}`).expect(200)).body.data;
      expect(info).toMatchObject({ role: 'TEACHER', schoolName: 'Greenfield Academy', children: [] });
      const session = (await http.post('/api/v1/auth/accept-invite').send({ code: inv.code, password: 'teacher-pass' }).expect(201)).body.data;
      expect(session.user).toMatchObject({ role: 'TEACHER', email: 'tunde@a.ng' });
      const list = (await owner.get('/api/v1/staff').expect(200)).body.data;
      expect(list.map((s: any) => [s.role, s.status])).toEqual([['SCHOOL_OWNER', 'ACTIVE'], ['PRINCIPAL', 'ACTIVE'], ['TEACHER', 'ACTIVE']]);
      expect(list[2]).toMatchObject({ teacherName: 'Tunde Bakare' });
      expect(list.some((s: any) => s.role === 'PARENT')).toBe(false);
    });

    it('refuses duplicate emails, parent emails and a teacher record that already has an account', async () => {
      await invite({}).expect(201);
      expect((await invite({}).expect(400)).body.message).toMatch(/already has an account/);
      expect((await invite({ email: 'mum@mail.com' }).expect(400)).body.message).toMatch(/parent account/);
      await invite({ email: 'x@a.ng', teacherId: 't1' }).expect(201);
      expect((await invite({ email: 'y@a.ng', teacherId: 't1' }).expect(400)).body.message).toMatch(/already has an account/);
      await invite({ email: 'z@a.ng', role: 'SCHOOL_OWNER' }).expect(400);
    });

    it('only lets the owner make or change principals, and nobody changes the owner or themselves', async () => {
      expect((await invite({ role: 'VICE_PRINCIPAL' }, principal).expect(403)).body.message).toMatch(/Only the school owner/);
      const acc = (await invite({ email: 'acc@a.ng', role: 'ACCOUNTANT' }, principal).expect(201)).body.data;
      await principal.patch(`/api/v1/staff/${acc.userId}/role`, { role: 'PRINCIPAL' }).expect(403);
      await principal.patch(`/api/v1/staff/${acc.userId}/role`, { role: 'TEACHER' }).expect(200);
      await principal.post('/api/v1/staff/owner-1/disable').expect(403);
      await principal.post('/api/v1/staff/prin-1/disable').expect(400);
      await owner.post('/api/v1/staff/prin-1/disable').expect(201);
      expect(db.peek('users', 'prin-1')!.status).toBe('DISABLED');
      await owner.post('/api/v1/staff/parent-1/disable').expect(404);
      await as(token('TEACHER', 't-x')).get('/api/v1/staff').expect(403);
    });

    it('switches accounts off and back on, and signs them out', async () => {
      const inv = (await invite({}).expect(201)).body.data;
      await http.post('/api/v1/auth/accept-invite').send({ code: inv.code, password: 'teacher-pass' }).expect(201);
      expect([...(db.store.get('refreshTokens')?.values() ?? [])].some((t) => t.userId === inv.userId)).toBe(true);
      await owner.post(`/api/v1/staff/${inv.userId}/disable`).expect(201);
      expect([...(db.store.get('refreshTokens')?.values() ?? [])].some((t) => t.userId === inv.userId)).toBe(false);
      await http.post('/api/v1/auth/login').send({ email: 'tunde@a.ng', password: 'teacher-pass' }).expect(401);
      await owner.post(`/api/v1/staff/${inv.userId}/enable`).expect(201);
      await http.post('/api/v1/auth/login').send({ email: 'tunde@a.ng', password: 'teacher-pass' }).expect(201);
      await owner.post(`/api/v1/staff/${inv.userId}/resend`).expect(400);
    });
  });

  describe('promotion', () => {
    it('suggests the next class across the usual boundaries', () => {
      const classes = ['Primary 5', 'Primary 6', 'JSS 1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3', 'JSS1A', 'JSS2A', 'Nursery'].map((name, i) => ({ id: `c${i}`, name }));
      const next = (n: string) => {
        const id = suggestNext(n, classes);
        return classes.find((c) => c.id === id)?.name ?? id;
      };
      expect(['Primary 5', 'Primary 6', 'JSS 1', 'JSS3', 'SS2', 'SS3', 'JSS1A', 'Nursery'].map(next)).toEqual(['Primary 6', 'JSS 1', 'JSS2', 'SS1', 'SS3', 'GRADUATE', 'JSS2A', 'STAY']);
    });

    it('moves everyone up at once, graduates the final year, holds back chosen students, and can be undone', async () => {
      const plan = (await owner.get('/api/v1/promotion/plan').expect(200)).body.data;
      const suggestion = Object.fromEntries(plan.classes.map((c: any) => [c.name, c.suggested]));
      expect(suggestion).toMatchObject({ 'Primary 6': 'jss1', 'JSS 1': 'jss2', JSS2: 'jss3', JSS3: 'ss1', SS3: 'GRADUATE' });
      const moves = plan.classes.map((c: any) => ({ fromClassId: c.classId, to: c.suggested }));
      const res = (await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves, holdBack: ['b'] }).expect(201)).body.data;
      expect(res.counts).toEqual({ promoted: 4, graduated: 1, stayed: 1 });
      // JSS1 -> JSS2 and JSS2 -> JSS3 at the same time don't collide.
      expect(['a', 'b', 'c', 'd', 'f'].map((id) => student(id).classId)).toEqual(['jss2', 'jss1', 'jss3', 'ss1', 'jss1']);
      expect(student('e')).toMatchObject({ status: 'INACTIVE', leftReason: 'GRADUATED', leftSession: '2027/2028' });
      await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves, holdBack: [] }).expect(400);

      await owner.post(`/api/v1/promotion/${res.id}/undo`).expect(201);
      expect(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => [student(id).classId, student(id).status])).toEqual([
        ['jss1', 'ACTIVE'], ['jss1', 'ACTIVE'], ['jss2', 'ACTIVE'], ['jss3', 'ACTIVE'], ['ss3', 'ACTIVE'], ['p6', 'ACTIVE'],
      ]);
      await owner.post(`/api/v1/promotion/${res.id}/undo`).expect(400);
      await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves, holdBack: [] }).expect(201);
    });

    it('refuses a second promotion into the same session even if its record were missing', async () => {
      const plan = (await owner.get('/api/v1/promotion/plan').expect(200)).body.data;
      const moves = plan.classes.map((c: any) => ({ fromClassId: c.classId, to: c.suggested }));
      const res = (await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves, holdBack: [] }).expect(201)).body.data;
      expect(db.peek('promotions', res.id)).toMatchObject({ status: 'DONE', moves: expect.any(Array) });
      expect(student('a')).toMatchObject({ classId: 'jss2', promotedInto: '2027/2028' });
      db.store.get('promotions')!.delete(res.id); // simulate the record going missing
      const again = await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves, holdBack: [] }).expect(400);
      expect(again.body.message).toMatch(/already been promoted into 2027\/2028/);
      expect(student('a').classId).toBe('jss2'); // not moved twice
    });

    it('validates moves and is admin-only', async () => {
      await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves: [{ fromClassId: 'jss1', to: 'nowhere' }], holdBack: [] }).expect(400);
      await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves: [{ fromClassId: 'jss1', to: 'STAY' }], holdBack: [] }).expect(400);
      await owner.post('/api/v1/promotion/apply', { toSession: '2027/2029', moves: [{ fromClassId: 'jss1', to: 'jss2' }], holdBack: [] }).expect(400);
      await owner.post('/api/v1/promotion/apply', { toSession: '2027/2028', moves: [{ fromClassId: 'jss1', to: 'jss2' }], holdBack: ['zzz'] }).expect(400);
      await as(token('TEACHER', 't-x')).get('/api/v1/promotion/plan').expect(403);
      await as(token('SCHOOL_OWNER', 'o-b', 'school-b')).post('/api/v1/promotion/apply', { toSession: '2027/2028', moves: [{ fromClassId: 'jss1', to: 'jss2' }], holdBack: [] }).expect(400);
      expect(student('a').classId).toBe('jss1');
    });
  });

  describe('school settings', () => {
    it('updates details and logo; teachers can read but not change them', async () => {
      const logo = 'data:image/png;base64,iVBORw0KGgo=';
      const res = (await owner.patch('/api/v1/school', { motto: '  Knowledge  and Character ', principalName: 'Mrs. A. Okon', logo }).expect(200)).body.data;
      expect(res).toMatchObject({ name: 'Greenfield Academy', motto: 'Knowledge and Character', principalName: 'Mrs. A. Okon', logo });
      await owner.patch('/api/v1/school', { logo: 'data:text/html;base64,PHNjcmlwdD4=' }).expect(400);
      await owner.patch('/api/v1/school', { name: '' }).expect(400);
      await owner.patch('/api/v1/school', { email: 'not-an-email' }).expect(400);
      await as(token('TEACHER', 't-x')).get('/api/v1/school').expect(200);
      await as(token('TEACHER', 't-x')).patch('/api/v1/school', { motto: 'x' }).expect(403);
      await as(token('PARENT', 'parent-1')).get('/api/v1/school').expect(403);
    });

    it('saves term dates and uses them for the current term', async () => {
      const terms = [
        { term: 'FIRST', start: '2026-09-14', end: '2026-12-18' },
        { term: 'SECOND', start: '2027-01-11', end: '2027-04-09' },
        { term: 'THIRD', start: '2027-04-26', end: '2027-07-23' },
      ];
      await owner.put('/api/v1/school/terms', { session: '2026/2027', terms: [{ ...terms[0], end: '2026-09-01' }] }).expect(400);
      await owner.put('/api/v1/school/terms', { session: '2026/2027', terms: [terms[0], { ...terms[1], start: '2026-12-01' }] }).expect(400);
      await owner.put('/api/v1/school/terms', { session: '2026/2027', terms: [{ ...terms[0], start: '2030-01-01', end: '2030-02-01' }] }).expect(400);
      const res = (await owner.put('/api/v1/school/terms', { session: '2026/2027', terms }).expect(200)).body.data;
      expect(res.termDates).toHaveLength(3);

      const cal = new TermCalendar(res.termDates);
      expect(cal.current('2026-10-03')).toEqual({ term: 'FIRST', session: '2026/2027' });
      expect(cal.current('2026-12-28')).toEqual({ term: 'FIRST', session: '2026/2027' }); // Christmas holiday
      expect(cal.current('2027-04-20')).toEqual({ term: 'SECOND', session: '2026/2027' }); // Easter holiday
      expect(cal.current('2027-04-27')).toEqual({ term: 'THIRD', session: '2026/2027' }); // fixed months would still say Second Term
      expect(cal.range('THIRD', '2026/2027')).toEqual({ from: '2027-04-26', to: '2027-07-23' });
      expect(cal.range('FIRST', '2027/2028')).toEqual({ from: '2027-09-01', to: '2027-12-31' });
      expect(new TermCalendar([]).current('2027-02-01')).toEqual({ term: 'SECOND', session: '2026/2027' });
    });
  });
});
