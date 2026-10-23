process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub: string) => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId: 'school-a' }, process.env.JWT_SECRET!);

describe('Teacher salaries are private to those who handle pay (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (role: string) => {
    const t = token(role, role.toLowerCase());
    return {
      get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
      post: (u: string, b: object) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
      patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
    };
  };
  const body = { firstName: 'Ada', lastName: 'New', dateOfBirth: '1990-01-01', gender: 'FEMALE', employeeNumber: 'E-2', email: 'ada@a.ng', phone: '08030000000', salary: 99000 };

  beforeEach(async () => {
    db = new FakeFirestore();
    for (const role of ['SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ACCOUNTANT']) {
      db.seed('users', role.toLowerCase(), { schoolId: 'school-a', role, status: 'ACTIVE', firstName: role, lastName: 'X', email: `${role}@a.ng` });
    }
    db.seed('teachers', 't1', { schoolId: 'school-a', firstName: 'Ngozi', lastName: 'Okeke', employeeNumber: 'E-1', salary: 150000, status: 'ACTIVE' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FirebaseService).useValue({ firestore: db }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(() => app.close());

  it('shows salaries only to the owner, principal and accountant', async () => {
    for (const role of ['SCHOOL_OWNER', 'PRINCIPAL', 'ACCOUNTANT']) {
      expect((await as(role).get('/api/v1/teachers').expect(200)).body.data[0].salary).toBe(150000);
      expect((await as(role).get('/api/v1/teachers/t1').expect(200)).body.data.salary).toBe(150000);
    }
    for (const role of ['TEACHER', 'VICE_PRINCIPAL']) {
      const list = (await as(role).get('/api/v1/teachers').expect(200)).body.data;
      expect(list[0]).toMatchObject({ firstName: 'Ngozi' });
      expect('salary' in list[0]).toBe(false);
      expect('salary' in (await as(role).get('/api/v1/teachers/t1').expect(200)).body.data).toBe(false);
    }
  });

  it("ignores a salary set by someone who doesn't handle pay", async () => {
    await as('VICE_PRINCIPAL').patch('/api/v1/teachers/t1', { salary: 1, phone: '08039999999' }).expect(200);
    expect(db.store.get('teachers')!.get('t1')).toMatchObject({ salary: 150000, phone: '08039999999' });
    const { id } = (await as('VICE_PRINCIPAL').post('/api/v1/teachers', body).expect(201)).body.data;
    expect(db.store.get('teachers')!.get(id)?.salary).toBeUndefined();
    await as('VICE_PRINCIPAL').post('/api/v1/teachers/bulk-import', { records: [{ ...body, employeeNumber: 'E-3', salary: '5000' }] }).expect(201);
    expect([...db.store.get('teachers')!.values()].find((t: any) => t.employeeNumber === 'E-3')).toMatchObject({ salary: null });

    await as('PRINCIPAL').patch('/api/v1/teachers/t1', { salary: 160000 }).expect(200);
    expect(db.store.get('teachers')!.get('t1')).toMatchObject({ salary: 160000 });
  });
});
