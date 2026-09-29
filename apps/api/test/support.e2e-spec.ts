process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { FakeFirestore } from './fake-firestore';

describe('Support chat messages (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;

  const message = { name: 'Ada Obi', email: 'Ada@Zafiri.ng', message: 'How do I import students?', conversationId: 'c-1', page: '/pricing' };
  const saved = () => [...(db.store.get('supportMessages')?.values() ?? [])];

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

  it('saves a visitor message without needing a login', async () => {
    await http.post('/api/v1/support/messages').send(message).expect(201);
    expect(saved()).toEqual([
      expect.objectContaining({ name: 'Ada Obi', email: 'ada@zafiri.ng', message: 'How do I import students?', conversationId: 'c-1', page: '/pricing', status: 'NEW' }),
    ]);
  });

  it('rejects a bad email, an empty message and an over-long message', async () => {
    await http.post('/api/v1/support/messages').send({ ...message, email: 'nope' }).expect(400);
    await http.post('/api/v1/support/messages').send({ ...message, message: '' }).expect(400);
    await http.post('/api/v1/support/messages').send({ ...message, message: 'x'.repeat(2001) }).expect(400);
    expect(saved()).toHaveLength(0);
  });

  it('pretends to accept bot submissions but stores nothing', async () => {
    await http.post('/api/v1/support/messages').send({ ...message, website: 'http://spam.example' }).expect(201);
    expect(saved()).toHaveLength(0);
  });

  it('limits how many messages one visitor can send in a short time', async () => {
    const send = (ip: string) => http.post('/api/v1/support/messages').set('X-Forwarded-For', ip).send(message);
    for (let i = 0; i < 8; i++) await send('203.0.113.7').expect(201);
    await send('203.0.113.7').expect(429);
    // A different visitor is unaffected
    await send('198.51.100.2').expect(201);
    expect(saved()).toHaveLength(9);
  });
});
