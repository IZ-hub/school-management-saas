process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

describe('Student CSV import with class names (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const owner = jwt.sign({ sub: 'u1', email: 'o@a.ng', role: 'SCHOOL_OWNER', schoolId: 'school-a' }, process.env.JWT_SECRET!);

  const student = (n: number, extra: Record<string, string> = {}) => ({ firstName: `S${n}`, lastName: 'Test', admissionNumber: `A/${n}`, ...extra });
  const importRows = (records: any[]) =>
    http.post('/api/v1/students/bulk-import').set('Authorization', `Bearer ${owner}`).send({ records }).expect(201);
  const classOf = (admissionNumber: string) =>
    [...(db.store.get('students')?.values() ?? [])].find((s) => s.admissionNumber === admissionNumber)?.classId;

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('classes', 'jss1a', { schoolId: 'school-a', name: 'JSS 1A', status: 'ACTIVE' });
    db.seed('classes', 'ss2b', { schoolId: 'school-a', name: 'SS 2B', status: 'ACTIVE' });
    db.seed('classes', 'dup1', { schoolId: 'school-a', name: 'Primary 4', status: 'ACTIVE' });
    db.seed('classes', 'dup2', { schoolId: 'school-a', name: 'primary 4', status: 'ACTIVE' });
    db.seed('classes', 'other', { schoolId: 'school-b', name: 'Other School Class', status: 'ACTIVE' });

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

  it('matches class names ignoring case and extra spaces', async () => {
    const res = await importRows([student(1, { className: 'JSS 1A' }), student(2, { className: 'jss 1a' }), student(3, { className: '  SS   2B ' })]);
    expect(res.body.data).toEqual({ imported: 3, errors: [] });
    expect(classOf('A/1')).toBe('jss1a');
    expect(classOf('A/2')).toBe('jss1a');
    expect(classOf('A/3')).toBe('ss2b');
  });

  it('matches names written with or without spaces, hyphens or dots (real report: "JSS 1A" vs class "JSS1A")', async () => {
    db.seed('classes', 'nospace', { schoolId: 'school-a', name: 'JSS3C', status: 'ACTIVE' });
    // An inactive class with the same name must not make the match ambiguous
    db.seed('classes', 'old', { schoolId: 'school-a', name: 'JSS3C', status: 'INACTIVE' });
    const res = await importRows([
      student(1, { className: 'JSS 3C' }),
      student(2, { className: 'jss-3c' }),
      student(3, { className: 'J.S.S 3C' }),
      student(4, { className: 'JSS1A' }),
    ]);
    expect(res.body.data).toEqual({ imported: 4, errors: [] });
    expect(['A/1', 'A/2', 'A/3'].map(classOf)).toEqual(['nospace', 'nospace', 'nospace']);
    expect(classOf('A/4')).toBe('jss1a');
  });

  it('imports students with no class, and still accepts the school’s own class IDs', async () => {
    const res = await importRows([student(1), student(2, { classId: 'ss2b' })]);
    expect(res.body.data.imported).toBe(2);
    expect(classOf('A/1')).toBeNull();
    expect(classOf('A/2')).toBe('ss2b');
  });

  it('skips rows whose class is unknown, ambiguous or belongs to another school, with clear messages', async () => {
    const res = await importRows([
      student(1, { className: 'JSS 9Z' }),
      student(2, { className: 'Primary 4' }),
      student(3, { classId: 'other' }),
      student(4, { className: 'JSS 1A' }),
    ]);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.errors).toEqual([
      { row: 1, message: 'Class "JSS 9Z" not found. Create it on the Classes page or check the spelling.' },
      { row: 2, message: 'More than one class is named "Primary 4". Rename one of them, then import again.' },
      { row: 3, message: 'Class "other" not found. Create it on the Classes page or check the spelling.' },
    ]);
    expect(classOf('A/1')).toBeUndefined();
    expect(classOf('A/4')).toBe('jss1a');
  });
});
