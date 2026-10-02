process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

describe('Classes: no duplicate names, safe delete (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const owner = jwt.sign({ sub: 'u1', email: 'o@a.ng', role: 'SCHOOL_OWNER', schoolId: 'school-a' }, process.env.JWT_SECRET!);
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${owner}`);
  const cls = (id: string) => db.peek('classes', id);

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('classes', 'jss2b', { schoolId: 'school-a', name: 'JSS2B', gradeLevel: 'JSS2', status: 'ACTIVE' });
    db.seed('classes', 'jss2b-twin', { schoolId: 'school-a', name: 'JSS2B', gradeLevel: 'JSS2', status: 'ACTIVE' });
    db.seed('classes', 'old', { schoolId: 'school-a', name: 'JSS9', gradeLevel: 'JSS9', status: 'INACTIVE' });
    db.seed('classes', 'other-school', { schoolId: 'school-b', name: 'Primary 1', gradeLevel: 'P1', status: 'ACTIVE' });
    db.seed('students', 's1', { schoolId: 'school-a', firstName: 'Ada', lastName: 'Obi', classId: 'jss2b', status: 'ACTIVE' });
    db.seed('students', 's2', { schoolId: 'school-a', firstName: 'Old', lastName: 'Pupil', classId: 'jss2b-twin', status: 'INACTIVE' });

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

  it('refuses to create a class whose name already exists, ignoring spacing and case', async () => {
    const res = await auth(http.post('/api/v1/classes').send({ name: 'jss 2b', gradeLevel: 'JSS2' })).expect(400);
    expect(res.body.message).toBe('A class named "JSS2B" already exists. Use a different name.');
    // Names used by deleted classes or other schools are free
    await auth(http.post('/api/v1/classes').send({ name: 'JSS9', gradeLevel: 'JSS9' })).expect(201);
    await auth(http.post('/api/v1/classes').send({ name: 'Primary 1', gradeLevel: 'P1' })).expect(201);
  });

  it('refuses renaming onto an existing name, but still lets a twin be edited or renamed away', async () => {
    db.seed('classes', 'jss3', { schoolId: 'school-a', name: 'JSS3', gradeLevel: 'JSS3', status: 'ACTIVE' });
    await auth(http.patch('/api/v1/classes/jss3').send({ name: 'JSS2B' })).expect(400);
    await auth(http.patch('/api/v1/classes/jss2b-twin').send({ name: 'JSS2B', capacity: 35 })).expect(200);
    await auth(http.patch('/api/v1/classes/jss2b-twin').send({ name: 'JSS2C' })).expect(200);
    expect(cls('jss2b-twin')!.name).toBe('JSS2C');
  });

  it('skips duplicate names in a class import, including repeats within the file', async () => {
    const res = await auth(
      http.post('/api/v1/classes/bulk-import').send({ records: [
        { name: 'JSS 2B', gradeLevel: 'JSS2' },
        { name: 'SS1', gradeLevel: 'SS1' },
        { name: 'ss 1', gradeLevel: 'SS1' },
      ] }),
    ).expect(201);
    expect(res.body.data).toEqual({
      imported: 1,
      errors: [
        { row: 1, message: 'A class named "JSS2B" already exists, so this row was skipped.' },
        { row: 3, message: 'A class named "SS1" already exists, so this row was skipped.' },
      ],
    });
  });

  it('will not delete a class that still has active students', async () => {
    const res = await auth(http.delete('/api/v1/classes/jss2b')).expect(400);
    expect(res.body).toMatchObject({ code: 'CLASS_HAS_STUDENTS', count: 1, message: '"JSS2B" still has 1 student. Move them to another class first.' });
    expect(cls('jss2b')!.status).toBe('ACTIVE');
  });

  it('deletes a class whose only students are inactive', async () => {
    const res = await auth(http.delete('/api/v1/classes/jss2b-twin')).expect(200);
    expect(res.body.data.message).toBe('Class deleted');
    expect(cls('jss2b-twin')!.status).toBe('INACTIVE');
  });
});

describe('Dashboard: students by class (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  const owner = jwt.sign({ sub: 'u1', email: 'o@a.ng', role: 'SCHOOL_OWNER', schoolId: 'school-a' }, process.env.JWT_SECRET!);

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('classes', 'c2', { schoolId: 'school-a', name: 'JSS2', capacity: 2, status: 'ACTIVE' });
    db.seed('classes', 'c10', { schoolId: 'school-a', name: 'JSS10', status: 'ACTIVE' });
    db.seed('classes', 'c1', { schoolId: 'school-a', name: 'JSS1', capacity: 40, status: 'ACTIVE' });
    db.seed('classes', 'gone', { schoolId: 'school-a', name: 'Old', capacity: 30, status: 'INACTIVE' });
    db.seed('classes', 'other', { schoolId: 'school-b', name: 'JSS1', capacity: 40, status: 'ACTIVE' });
    const st = (id: string, classId: string | null, status = 'ACTIVE', schoolId = 'school-a') =>
      db.seed('students', id, { schoolId, firstName: id, lastName: 'X', classId, status });
    st('a', 'c1'); st('b', 'c2'); st('c', 'c2'); st('d', 'c2');
    st('e', null); st('f', 'gone'); st('g', 'c1', 'INACTIVE'); st('h', 'other', 'ACTIVE', 'school-b');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ firestore: db })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('counts active students per active class, in class order, and those without a class', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/dashboard/class-sizes').set('Authorization', `Bearer ${owner}`).expect(200);
    expect(res.body.data).toEqual({
      classes: [
        { id: 'c1', name: 'JSS1', capacity: 40, students: 1 },
        { id: 'c2', name: 'JSS2', capacity: 2, students: 3 },
        { id: 'c10', name: 'JSS10', capacity: null, students: 0 },
      ],
      withoutClass: 2,
      totalStudents: 6,
    });
  });
});
