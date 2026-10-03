const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.JWT_SECRET = TEST_SECRET;

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { getJwtSecret } from '../src/common/jwt-secret';
import { FakeFirestore } from './fake-firestore';

const tokenFor = (schoolId: string, role: string, secret = TEST_SECRET) =>
  jwt.sign({ sub: `${schoolId}-${role}`, email: 'x@example.com', role, schoolId }, secret);

describe('Tenant isolation and role checks (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;

  const ownerA = tokenFor('school-a', 'SCHOOL_OWNER');
  const ownerB = tokenFor('school-b', 'SCHOOL_OWNER');

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('students', 'stu-a', { schoolId: 'school-a', firstName: 'Ada', lastName: 'A', status: 'ACTIVE' });
    db.seed('timetables', 'tt-a', { schoolId: 'school-a', day: 'Monday', room: '1' });

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

  describe('cross-school access by ID', () => {
    it('lets a school read and update its own student', async () => {
      await http.get('/api/v1/students/stu-a').set('Authorization', `Bearer ${ownerA}`).expect(200);
      await http
        .patch('/api/v1/students/stu-a')
        .set('Authorization', `Bearer ${ownerA}`)
        .send({ firstName: 'Adaeze' })
        .expect(200);
      expect(db.peek('students', 'stu-a')!.firstName).toBe('Adaeze');
    });

    it('hides another school’s student as 404 on read, update and delete', async () => {
      await http.get('/api/v1/students/stu-a').set('Authorization', `Bearer ${ownerB}`).expect(404);
      await http
        .patch('/api/v1/students/stu-a')
        .set('Authorization', `Bearer ${ownerB}`)
        .send({ firstName: 'Hacked' })
        .expect(404);
      await http.delete('/api/v1/students/stu-a').set('Authorization', `Bearer ${ownerB}`).expect(404);

      expect(db.peek('students', 'stu-a')).toMatchObject({ firstName: 'Ada', status: 'ACTIVE' });
    });

    it('blocks another school from editing or deleting a timetable entry', async () => {
      await http
        .patch('/api/v1/timetable/tt-a')
        .set('Authorization', `Bearer ${ownerB}`)
        .send({ room: '99' })
        .expect(404);
      await http.delete('/api/v1/timetable/tt-a').set('Authorization', `Bearer ${ownerB}`).expect(404);
      expect(db.peek('timetables', 'tt-a')!.room).toBe('1');
    });

    it('lets a school create, filter and edit its own timetable', async () => {
      await http
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${ownerA}`)
        .send({ classId: 'c1', subjectId: 's1', teacherId: 't1', room: '2', day: 'Tuesday', startTime: '08:00', endTime: '09:00' })
        .expect(201);
      const res = await http
        .get('/api/v1/timetable?day=Tuesday')
        .set('Authorization', `Bearer ${ownerA}`)
        .expect(200);
      expect(res.body.data).toHaveLength(1);

      await http
        .patch('/api/v1/timetable/tt-a')
        .set('Authorization', `Bearer ${ownerA}`)
        .send({ room: '5' })
        .expect(200);
      expect(db.peek('timetables', 'tt-a')!.room).toBe('5');
    });

    it('returns 404 instead of crashing for a missing timetable entry', async () => {
      await http.delete('/api/v1/timetable/nope').set('Authorization', `Bearer ${ownerA}`).expect(404);
    });

    it('refuses a payment for another school’s student and records nothing', async () => {
      await http
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${ownerB}`)
        .send({ studentId: 'stu-a', term: 'FIRST', session: '2026/2027', amount: 500, method: 'CASH', paidOn: '2026-09-15' })
        .expect(404);
      expect(db.store.get('feePayments')?.size ?? 0).toBe(0);
    });

    it('still scopes list endpoints to the caller’s school', async () => {
      const res = await http.get('/api/v1/students').set('Authorization', `Bearer ${ownerB}`).expect(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('role checks', () => {
    const teacherA = tokenFor('school-a', 'TEACHER');
    const accountantA = tokenFor('school-a', 'ACCOUNTANT');
    const parentA = tokenFor('school-a', 'PARENT');
    const studentA = tokenFor('school-a', 'STUDENT');

    it('lets teachers view students but not create or delete them', async () => {
      await http.get('/api/v1/students').set('Authorization', `Bearer ${teacherA}`).expect(200);
      await http
        .post('/api/v1/students/bulk-import')
        .set('Authorization', `Bearer ${teacherA}`)
        .send({ records: [] })
        .expect(403);
      await http.delete('/api/v1/students/stu-a').set('Authorization', `Bearer ${teacherA}`).expect(403);
      expect(db.peek('students', 'stu-a')!.status).toBe('ACTIVE');
    });

    it('keeps teachers out of finance and accountants out of academics', async () => {
      await http.get('/api/v1/fees/overview').set('Authorization', `Bearer ${teacherA}`).expect(403);
      await http.get('/api/v1/fees/overview').set('Authorization', `Bearer ${accountantA}`).expect(200);
      await http.get('/api/v1/results').set('Authorization', `Bearer ${accountantA}`).expect(403);
      await http.get('/api/v1/results').set('Authorization', `Bearer ${teacherA}`).expect(200);
    });

    it('blocks parents and students from school-wide data', async () => {
      for (const token of [parentA, studentA]) {
        await http.get('/api/v1/students').set('Authorization', `Bearer ${token}`).expect(403);
        await http.get('/api/v1/results').set('Authorization', `Bearer ${token}`).expect(403);
        await http.get('/api/v1/fees/overview').set('Authorization', `Bearer ${token}`).expect(403);
        await http.get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${token}`).expect(403);
      }
    });

    it('lets the owner reach every area', async () => {
      for (const path of ['students', 'teachers', 'classes', 'subjects', 'attendance', 'exams', 'results', 'fees/overview', 'payments', 'timetable', 'dashboard/stats']) {
        await http.get(`/api/v1/${path}`).set('Authorization', `Bearer ${ownerA}`).expect(200);
      }
    });
  });

  describe('JWT secret', () => {
    it('rejects a token signed with the old hard-coded fallback secret', async () => {
      const forged = tokenFor('school-a', 'SCHOOL_OWNER', 'default_jwt_secret');
      await http.get('/api/v1/students').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('refuses to run without JWT_SECRET', () => {
      const saved = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        expect(() => getJwtSecret()).toThrow(/JWT_SECRET is not set/);
      } finally {
        process.env.JWT_SECRET = saved;
      }
    });

    it('refuses the placeholder secret from .env.example and short secrets', () => {
      const saved = process.env.JWT_SECRET;
      try {
        process.env.JWT_SECRET = 'your_jwt_secret_change_in_production';
        expect(() => getJwtSecret()).toThrow(/placeholder/);
        process.env.JWT_SECRET = 'short';
        expect(() => getJwtSecret()).toThrow(/placeholder/);
      } finally {
        process.env.JWT_SECRET = saved;
      }
    });
  });
});
