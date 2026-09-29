process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

describe('Login and school registration (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;

  const registration = {
    schoolName: 'Zafiri Academy',
    schoolEmail: 'office@zafiri.ng',
    phone: '07031900023',
    address: '12 Admiralty Way',
    country: 'Nigeria',
    state: 'FCT',
    city: 'Abuja',
    schoolType: 'Primary & Secondary',
    ownerFirstName: 'Ada',
    ownerLastName: 'Obi',
    ownerEmail: 'ada@zafiri.ng',
    ownerPassword: 'secret123',
  };

  beforeEach(async () => {
    db = new FakeFirestore();
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

  it('registers a school with location and type, then logs in with just email and password', async () => {
    const reg = await http.post('/api/v1/schools/register').send(registration).expect(201);
    const schoolId = reg.body.data.user.schoolId;
    expect(db.peek('schools', schoolId)).toMatchObject({ state: 'FCT', city: 'Abuja', country: 'Nigeria', schoolType: 'Primary & Secondary' });

    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: 'ada@zafiri.ng', password: 'secret123' })
      .expect(201);
    expect(login.body.data.user).toMatchObject({ email: 'ada@zafiri.ng', role: 'SCHOOL_OWNER', schoolId });
    expect(login.body.data.accessToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password without revealing which part was wrong', async () => {
    await http.post('/api/v1/schools/register').send(registration).expect(201);
    const res = await http.post('/api/v1/auth/login').send({ email: 'ada@zafiri.ng', password: 'nope' }).expect(401);
    expect(res.body.message).toBe('Invalid credentials');
    await http.post('/api/v1/auth/login').send({ email: 'nobody@zafiri.ng', password: 'secret123' }).expect(401);
  });

  it('asks for a School ID only when an email exists at more than one school', async () => {
    const hash = await bcrypt.hash('secret123', 4);
    const user = { email: 'shared@x.ng', password: hash, status: 'ACTIVE', role: 'TEACHER', firstName: 'S', lastName: 'H' };
    db.seed('users', 'u1', { ...user, schoolId: 'school-1' });
    db.seed('users', 'u2', { ...user, schoolId: 'school-2' });

    const res = await http.post('/api/v1/auth/login').send({ email: 'shared@x.ng', password: 'secret123' }).expect(400);
    expect(res.body.code).toBe('SCHOOL_ID_REQUIRED');

    const ok = await http
      .post('/api/v1/auth/login')
      .send({ email: 'shared@x.ng', password: 'secret123', schoolId: 'school-2' })
      .expect(201);
    expect(ok.body.data.user.schoolId).toBe('school-2');
  });

  it('still rejects unknown registration fields', async () => {
    await http.post('/api/v1/schools/register').send({ ...registration, isAdmin: true }).expect(400);
  });
});
