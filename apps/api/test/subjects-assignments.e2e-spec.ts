process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, schoolId = 'school-a') =>
  jwt.sign({ sub: `${schoolId}-${role}`, email: 'x@a.ng', role, schoolId }, process.env.JWT_SECRET!);

describe('Subjects and teaching assignments (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const owner = token('SCHOOL_OWNER');
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b?: object) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
    del: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
  });
  const api = as(owner);
  const assignments = () => [...(db.store.get('teachingAssignments')?.values() ?? [])];

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('classes', 'jss1a', { schoolId: 'school-a', name: 'JSS1A', status: 'ACTIVE' });
    db.seed('classes', 'jss2b', { schoolId: 'school-a', name: 'JSS2B', status: 'ACTIVE' });
    db.seed('classes', 'gone', { schoolId: 'school-a', name: 'JSS9', status: 'INACTIVE' });
    db.seed('subjects', 'mth', { schoolId: 'school-a', name: 'Mathematics', code: 'MTH', status: 'ACTIVE' });
    db.seed('subjects', 'eng', { schoolId: 'school-a', name: 'English Language', code: 'ENG', status: 'ACTIVE' });
    db.seed('subjects', 'fre', { schoolId: 'school-a', name: 'French', code: 'FRE', status: 'INACTIVE' });
    db.seed('teachers', 't-eze', { schoolId: 'school-a', firstName: 'Chinedu', lastName: 'Eze', email: 'c.eze@gfa.ng', employeeNumber: 'T-001', status: 'ACTIVE' });
    db.seed('teachers', 't-bello', { schoolId: 'school-a', firstName: 'Funke', lastName: 'Bello', email: 'f.bello@gfa.ng', employeeNumber: 'T-002', status: 'ACTIVE' });
    db.seed('classes', 'b-class', { schoolId: 'school-b', name: 'JSS1A', status: 'ACTIVE' });
    db.seed('teachers', 'b-teacher', { schoolId: 'school-b', firstName: 'Other', lastName: 'School', status: 'ACTIVE' });

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

  describe('subjects', () => {
    it('refuses duplicate names and codes, ignoring case and spacing, and stores codes in capitals', async () => {
      expect((await api.post('/api/v1/subjects', { name: 'mathematics', code: 'MAT' }).expect(400)).body.message).toBe('A subject named "Mathematics" already exists.');
      expect((await api.post('/api/v1/subjects', { name: 'Further Maths', code: 'mth' }).expect(400)).body.message).toBe('The code "MTH" is already used by Mathematics.');
      const ok = await api.post('/api/v1/subjects', { name: 'Basic Science', code: 'bsc ' }).expect(201);
      expect(ok.body.data.code).toBe('BSC');
      // An archived subject's name and code are free to reuse
      await api.post('/api/v1/subjects', { name: 'French', code: 'FRE' }).expect(201);
    });

    it('archives with delete, and restores only when the name and code are still free', async () => {
      await api.del('/api/v1/subjects/eng').expect(200);
      expect(db.peek('subjects', 'eng')!.status).toBe('INACTIVE');
      await api.patch('/api/v1/subjects/eng', { status: 'ACTIVE' }).expect(200);
      expect(db.peek('subjects', 'eng')!.status).toBe('ACTIVE');

      await api.post('/api/v1/subjects', { name: 'French', code: 'FR' }).expect(201);
      const res = await api.patch('/api/v1/subjects/fre', { status: 'ACTIVE' }).expect(400);
      expect(res.body.message).toBe('Can\'t restore: A subject named "French" already exists.');
    });

    it('lets a subject be edited without tripping over its own name', async () => {
      await api.patch('/api/v1/subjects/mth', { name: 'Mathematics', code: 'mth' }).expect(200);
      await api.patch('/api/v1/subjects/mth', { name: 'English Language' }).expect(400);
    });

    it('skips duplicate subjects in an import', async () => {
      const res = await api.post('/api/v1/subjects/bulk-import', { records: [
        { name: 'Maths', code: 'MTH' },
        { name: 'Civic Education', code: 'CVE' },
        { name: 'civic education', code: 'CIV' },
      ] }).expect(201);
      expect(res.body.data).toEqual({
        imported: 1,
        errors: [
          { row: 1, message: 'The code "MTH" is already used by Mathematics, so this row was skipped.' },
          { row: 3, message: 'A subject named "Civic Education" already exists, so this row was skipped.' },
        ],
      });
    });
  });

  describe('teaching assignments', () => {
    it('assigns a subject to a class with a teacher, once per class and subject', async () => {
      const res = await api.post('/api/v1/teaching-assignments', { classId: 'jss1a', subjectId: 'mth', teacherId: 't-eze' }).expect(201);
      expect(res.body.data).toMatchObject({ classId: 'jss1a', subjectId: 'mth', teacherId: 't-eze' });
      await api.post('/api/v1/teaching-assignments', { classId: 'jss2b', subjectId: 'mth' }).expect(201);
      const dup = await api.post('/api/v1/teaching-assignments', { classId: 'jss1a', subjectId: 'mth', teacherId: 't-bello' }).expect(400);
      expect(dup.body.message).toBe('JSS1A already takes Mathematics. Change its teacher instead.');

      const list = await api.get('/api/v1/teaching-assignments?classId=jss1a').expect(200);
      expect(list.body.data).toHaveLength(1);
    });

    it('changes or clears the teacher, and removes the subject from the class', async () => {
      const { body } = await api.post('/api/v1/teaching-assignments', { classId: 'jss1a', subjectId: 'eng', teacherId: 't-eze' }).expect(201);
      await api.patch(`/api/v1/teaching-assignments/${body.data.id}`, { teacherId: 't-bello' }).expect(200);
      expect(db.peek('teachingAssignments', body.data.id)!.teacherId).toBe('t-bello');
      await api.patch(`/api/v1/teaching-assignments/${body.data.id}`, { teacherId: null }).expect(200);
      expect(db.peek('teachingAssignments', body.data.id)!.teacherId).toBeNull();
      await api.del(`/api/v1/teaching-assignments/${body.data.id}`).expect(200);
      expect(assignments()).toHaveLength(0);
    });

    it('refuses deleted classes, archived subjects, and anything from another school', async () => {
      expect((await api.post('/api/v1/teaching-assignments', { classId: 'gone', subjectId: 'mth' }).expect(400)).body.message).toBe('That class has been deleted.');
      expect((await api.post('/api/v1/teaching-assignments', { classId: 'jss1a', subjectId: 'fre' }).expect(400)).body.message).toBe('That subject has been archived.');
      await api.post('/api/v1/teaching-assignments', { classId: 'b-class', subjectId: 'mth' }).expect(404);
      await api.post('/api/v1/teaching-assignments', { classId: 'jss1a', subjectId: 'mth', teacherId: 'b-teacher' }).expect(404);

      const other = as(token('SCHOOL_OWNER', 'school-b'));
      const { body } = await api.post('/api/v1/teaching-assignments', { classId: 'jss1a', subjectId: 'mth' }).expect(201);
      await other.patch(`/api/v1/teaching-assignments/${body.data.id}`, { teacherId: 'b-teacher' }).expect(404);
      await other.del(`/api/v1/teaching-assignments/${body.data.id}`).expect(404);
      expect((await other.get('/api/v1/teaching-assignments').expect(200)).body.data).toEqual([]);
    });

    it('lets teachers view assignments but only admins change them', async () => {
      const teacher = as(token('TEACHER'));
      await teacher.get('/api/v1/teaching-assignments').expect(200);
      await teacher.post('/api/v1/teaching-assignments', { classId: 'jss1a', subjectId: 'mth' }).expect(403);
      await as(token('PARENT')).get('/api/v1/teaching-assignments').expect(403);
    });

    it('imports by class name, subject name or code, and teacher email, number or name', async () => {
      await api.post('/api/v1/teaching-assignments', { classId: 'jss2b', subjectId: 'eng' }).expect(201);
      const res = await api.post('/api/v1/teaching-assignments/bulk-import', { records: [
        { className: 'JSS 1A', subject: 'MTH', teacher: 'c.eze@gfa.ng' },
        { className: 'jss1a', subject: 'English Language', teacher: 't-002' },
        { className: 'JSS2B', subject: 'mathematics', teacher: 'Funke Bello' },
        { className: 'JSS2B', subject: 'ENG', teacher: '' },
        { className: 'JSS1A', subject: 'Mathematics' },
        { className: 'JSS7', subject: 'MTH' },
        { className: 'JSS2B', subject: 'French' },
        { className: 'JSS1A', subject: 'Basic Tech', teacher: 'Nobody' },
      ] }).expect(201);
      expect(res.body.data.imported).toBe(3);
      expect(res.body.data.errors).toEqual([
        { row: 4, message: 'JSS2B already takes English Language, so this row was skipped.' },
        { row: 5, message: 'JSS1A – Mathematics is also on row 1 of this file, so this row was skipped.' },
        { row: 6, message: 'Class "JSS7" not found. Create it on the Classes page or check the spelling.' },
        { row: 7, message: 'Subject "French" not found. Add it on the Subjects page or check the spelling.' },
        { row: 8, message: 'Subject "Basic Tech" not found. Add it on the Subjects page or check the spelling.' },
      ]);
      const byPair = Object.fromEntries(assignments().map((a) => [`${a.classId}|${a.subjectId}`, a.teacherId]));
      expect(byPair).toMatchObject({ 'jss1a|mth': 't-eze', 'jss1a|eng': 't-bello', 'jss2b|mth': 't-bello' });
    });
  });
});
