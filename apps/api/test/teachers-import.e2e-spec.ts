process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

describe('Teacher CSV import (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const owner = jwt.sign({ sub: 'u1', email: 'o@a.ng', role: 'SCHOOL_OWNER', schoolId: 'school-a' }, process.env.JWT_SECRET!);

  const teacher = (n: number, extra: Record<string, string> = {}) => ({ firstName: `T${n}`, lastName: 'Test', employeeNumber: `EMP-${n}`, email: `t${n}@school.ng`, phone: '08031234567', ...extra });
  const importRows = (records: any[]) =>
    http.post('/api/v1/teachers/bulk-import').set('Authorization', `Bearer ${owner}`).send({ records }).expect(201);
  const byNumber = (n: string) => [...(db.store.get('teachers')?.values() ?? [])].find((t) => t.employeeNumber === n);

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('teachers', 'old', { schoolId: 'school-a', firstName: 'Ngozi', lastName: 'Okeke', employeeNumber: 'EMP-1', status: 'ACTIVE' });
    db.seed('teachers', 'b', { schoolId: 'school-b', firstName: 'Other', lastName: 'School', employeeNumber: 'EMP-9', status: 'ACTIVE' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FirebaseService).useValue({ firestore: db }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(() => app.close());

  it('reads day-first dates, M/F genders, salaries with ₦ and commas, and phones missing their 0', async () => {
    const res = await importRows([
      teacher(2, { dateOfBirth: '14/05/1988', joiningDate: '9 September 2024', gender: 'F', salary: '₦150,000', phone: '8031234567' }),
      teacher(3, { dateOfBirth: '1990-01-31', gender: 'male', salary: '95000.50' }),
      teacher(9), // EMP-9 belongs to another school, so it's free here
    ]);
    expect(res.body.data).toEqual({ imported: 3, errors: [] });
    expect(byNumber('EMP-2')).toMatchObject({ dateOfBirth: '1988-05-14', joiningDate: '2024-09-09', gender: 'FEMALE', salary: 150000, phone: '08031234567', status: 'ACTIVE' });
    expect(byNumber('EMP-3')).toMatchObject({ dateOfBirth: '1990-01-31', gender: 'MALE', salary: 95000.5, joiningDate: null });
  });

  it('skips teachers already in the school or repeated in the file, so a file can be uploaded again', async () => {
    const res = await importRows([teacher(1), teacher(4), teacher(4, { firstName: 'Again' }), teacher(5, { employeeNumber: ' emp-4 ' })]);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.errors).toEqual([
      { row: 1, message: 'Employee number EMP-1 already belongs to Ngozi Okeke, so this row was skipped.' },
      { row: 3, message: 'Employee number EMP-4 is also on row 2 of this file, so this row was skipped.' },
      { row: 4, message: 'Employee number emp-4 is also on row 2 of this file, so this row was skipped.' },
    ]);
    // Uploading the same file again adds nobody.
    expect((await importRows([teacher(1), teacher(4)])).body.data.imported).toBe(0);
  });

  it('explains each row it cannot read', async () => {
    const res = await importRows([
      teacher(6, { email: '' , phone: '' }),
      teacher(7, { email: 'not-an-email' }),
      teacher(8, { dateOfBirth: '31/02/1990' }),
      teacher(10, { joiningDate: 'last year' }),
      teacher(11, { gender: 'x' }),
      teacher(12, { salary: 'a lot' }),
    ]);
    expect(res.body.data.imported).toBe(0);
    expect(res.body.data.errors.map((e: any) => e.message)).toEqual([
      'Missing Email, Phone.',
      'Email "not-an-email" doesn\'t look like an email address.',
      'Date of birth "31/02/1990" wasn\'t understood. Write it day first, like 14/05/1988.',
      'Joining date "last year" wasn\'t understood. Write it day first, like 09/09/2024.',
      'Gender "x" wasn\'t understood. Write Male or Female.',
      'Salary "a lot" isn\'t an amount. Write it like 150000.',
    ]);
  });
});
