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

  it('prefers the class spelled exactly as written when spellings collide (real report: "JSS2B" and "JSS 2B")', async () => {
    db.seed('classes', 'nospace2b', { schoolId: 'school-a', name: 'JSS2B', status: 'ACTIVE' });
    db.seed('classes', 'space2b', { schoolId: 'school-a', name: 'JSS 2B', status: 'ACTIVE' });
    const res = await importRows([
      student(1, { className: 'JSS 2B' }),
      student(2, { className: 'jss2b' }),
      student(3, { className: 'JSS-2B' }),
    ]);
    expect(res.body.data.imported).toBe(2);
    expect(classOf('A/1')).toBe('space2b');
    expect(classOf('A/2')).toBe('nospace2b');
    expect(res.body.data.errors).toEqual([
      { row: 3, message: 'More than one class matches "JSS-2B": "JSS2B" and "JSS 2B". Delete or rename the extra one on the Classes page, then import again.' },
    ]);
  });

  it('skips students already in the school and repeats within the file, so a file can be re-imported', async () => {
    db.seed('students', 'existing', { schoolId: 'school-a', firstName: 'Chinedu', lastName: 'Okafor', admissionNumber: 'GFA/2026/102', status: 'ACTIVE' });
    db.seed('students', 'other-school', { schoolId: 'school-b', firstName: 'X', lastName: 'Y', admissionNumber: 'GFA/2026/200', status: 'ACTIVE' });
    const res = await importRows([
      { firstName: 'Chinedu', lastName: 'Okafor', admissionNumber: 'gfa/2026/102' },
      { firstName: 'Amaka', lastName: 'Eze', admissionNumber: 'GFA/2026/103' },
      { firstName: 'Amaka', lastName: 'Eze', admissionNumber: 'GFA/2026/103' },
      { firstName: 'New', lastName: 'Pupil', admissionNumber: 'GFA/2026/200' },
    ]);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.errors).toEqual([
      { row: 1, message: 'Admission number gfa/2026/102 already belongs to Chinedu Okafor, so this row was skipped.' },
      { row: 3, message: 'Admission number GFA/2026/103 is also on row 2 of this file, so this row was skipped.' },
    ]);

    // Importing the same file again adds nothing new
    const again = await importRows([{ firstName: 'Amaka', lastName: 'Eze', admissionNumber: 'GFA/2026/103' }]);
    expect(again.body.data.imported).toBe(0);
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
      { row: 2, message: 'More than one class matches "Primary 4": "Primary 4" and "primary 4". Delete or rename the extra one on the Classes page, then import again.' },
      { row: 3, message: 'Class "other" not found. Create it on the Classes page or check the spelling.' },
    ]);
    expect(classOf('A/1')).toBeUndefined();
    expect(classOf('A/4')).toBe('jss1a');
  });

  it('reads dates of birth and genders the way schools type them in Excel', async () => {
    const res = await importRows([
      student(1, { dateOfBirth: '14/03/2015', gender: 'Male' }),
      student(2, { dateOfBirth: '2015-03-14', gender: 'F' }),
      student(3, { dateOfBirth: '4-9-2014', gender: 'girl' }),
      student(4, { dateOfBirth: '14 March 2015', gender: 'MALE' }),
      student(5, { dateOfBirth: '42077' }), // Excel's own number for 14/03/2015
      student(6),
      student(7, { dateOfBirth: '31/02/2015' }), // no such day
      student(8, { dateOfBirth: '03/14/2015' }), // month first: not Nigerian order
      student(9, { gender: 'unknown' }),
    ]);
    const saved = (adm: string) => [...(db.store.get('students')?.values() ?? [])].find((x) => x.admissionNumber === adm);
    expect(res.body.data.imported).toBe(6);
    expect(saved('A/1')).toMatchObject({ dateOfBirth: '2015-03-14', gender: 'MALE' });
    expect(saved('A/2')).toMatchObject({ dateOfBirth: '2015-03-14', gender: 'FEMALE' });
    expect(saved('A/3')).toMatchObject({ dateOfBirth: '2014-09-04', gender: 'FEMALE' });
    expect(saved('A/4')).toMatchObject({ dateOfBirth: '2015-03-14', gender: 'MALE' });
    expect(saved('A/5')).toMatchObject({ dateOfBirth: '2015-03-14' });
    expect(saved('A/6')).toMatchObject({ dateOfBirth: '', gender: '' });
    expect(res.body.data.errors).toEqual([
      { row: 7, message: 'Date of birth "31/02/2015" wasn\'t understood. Write it day first, like 14/03/2015.' },
      { row: 8, message: 'Date of birth "03/14/2015" wasn\'t understood. Write it day first, like 14/03/2015.' },
      { row: 9, message: 'Gender "unknown" wasn\'t understood. Write Male or Female.' },
    ]);
  });
});
