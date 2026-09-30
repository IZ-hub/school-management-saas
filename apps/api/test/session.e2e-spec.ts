process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

describe('Staying signed in with refresh tokens (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;

  const sessionCookie = (res: request.Response) =>
    ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('__session='));
  const cookieValue = (setCookie?: string) => setCookie!.split(';')[0];
  const tokenDocs = () => [...(db.store.get('refreshTokens')?.entries() ?? [])];

  const registerAndGetCookie = async () => {
    const res = await http
      .post('/api/v1/schools/register')
      .send({ schoolName: 'Zafiri Academy', schoolEmail: 'office@zafiri.ng', ownerFirstName: 'Ada', ownerLastName: 'Obi', ownerEmail: 'ada@zafiri.ng', ownerPassword: 'secret123' })
      .expect(201);
    return { res, cookie: cookieValue(sessionCookie(res)) };
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

  it('sets a secure, script-proof cookie on sign-in and keeps the refresh token out of the response body', async () => {
    const { res } = await registerAndGetCookie();
    const setCookie = sessionCookie(res)!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(JSON.stringify(res.body)).not.toContain(cookieValue(setCookie).split('=')[1].split('.')[1]);
    // Only a hash of the secret is stored
    const [[, stored]] = tokenDocs();
    expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);

    const login = await http.post('/api/v1/auth/login').send({ email: 'ada@zafiri.ng', password: 'secret123' }).expect(201);
    expect(sessionCookie(login)).toBeDefined();
  });

  it('renews an expired session with the cookie and the new access token works', async () => {
    const { cookie } = await registerAndGetCookie();
    const res = await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(201);
    expect(res.body.data.user).toMatchObject({ email: 'ada@zafiri.ng', role: 'SCHOOL_OWNER' });
    expect(sessionCookie(res)).toBeDefined();
    expect(cookieValue(sessionCookie(res))).not.toBe(cookie);
    await http.get('/api/v1/students').set('Authorization', `Bearer ${res.body.data.accessToken}`).expect(200);
  });

  it('allows a just-used cookie briefly (two tabs) but refuses it after the grace period', async () => {
    const { cookie } = await registerAndGetCookie();
    await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(201);
    await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(201);

    const id = cookie.split('=')[1].split('.')[0];
    db.store.get('refreshTokens')!.get(id)!.rotatedAt = new Date(Date.now() - 5 * 60 * 1000);
    const res = await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    expect(sessionCookie(res)).toMatch(/__session=;/); // cookie cleared
  });

  it('refuses missing, forged and expired cookies', async () => {
    await http.post('/api/v1/auth/refresh').expect(401);
    await http.post('/api/v1/auth/refresh').set('Cookie', '__session=nope').expect(401);
    const { cookie } = await registerAndGetCookie();
    const [id] = cookie.split('=')[1].split('.');
    await http.post('/api/v1/auth/refresh').set('Cookie', `__session=${id}.wrongsecret`).expect(401);

    db.store.get('refreshTokens')!.get(id)!.expiresAt = new Date(Date.now() - 1000);
    await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('signing out revokes the session', async () => {
    const { cookie } = await registerAndGetCookie();
    await http.post('/api/v1/auth/logout').set('Cookie', cookie).expect(201);
    expect(tokenDocs()).toHaveLength(0);
    await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('refuses to renew for a deactivated user', async () => {
    const { res, cookie } = await registerAndGetCookie();
    db.store.get('users')!.get(res.body.data.user.id)!.status = 'SUSPENDED';
    await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });
});
