process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { forgetBilling } from '../src/modules/auth/guards/jwt-auth.guard';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub = 'owner-1', schoolId = 'school-a') =>
  jwt.sign({ sub, email: `${role.toLowerCase()}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

const PHOTO = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
const THUMB = `data:image/jpeg;base64,${'B'.repeat(800)}`;

describe('Student photo and admission date (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const owner = token('SCHOOL_OWNER');
  const teacher = token('TEACHER', 'teacher-1');
  const otherSchool = token('SCHOOL_OWNER', 'owner-b', 'school-b');
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
    del: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
  });

  beforeEach(async () => {
    db = new FakeFirestore();
    forgetBilling('school-a');
    forgetBilling('school-b');
    db.seed('schools', 'school-a', { name: 'Greenfield', createdAt: new Date() });
    db.seed('schools', 'school-b', { name: 'Other', createdAt: new Date() });
    db.seed('users', 'owner-1', { schoolId: 'school-a', firstName: 'Funke', lastName: 'Bello', email: 'f@a.ng' });
    db.seed('users', 'owner-b', { schoolId: 'school-b', firstName: 'B', lastName: 'B', email: 'b@b.ng' });
    db.seed('users', 'teacher-1', { schoolId: 'school-a', role: 'TEACHER', teacherId: 't1', firstName: 'Tunde', lastName: 'B', email: 't@a.ng' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('students', 's1', { schoolId: 'school-a', firstName: 'Chioma', lastName: 'Eze', admissionNumber: 'A/1', classId: 'jss1', status: 'ACTIVE', dateOfBirth: '2014-03-14', gender: 'FEMALE' });

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

  afterEach(() => app.close());

  it('saves an admission date when adding and editing a student, and rejects a bad one', async () => {
    const body = { firstName: 'Ade', lastName: 'Ola', dateOfBirth: '2015-01-02', gender: 'MALE', admissionNumber: 'A/2' };
    await as(owner).post('/api/v1/students', { ...body, admissionDate: '14/09/2026' }).expect(400);
    const { id } = (await as(owner).post('/api/v1/students', { ...body, admissionDate: '2026-09-14' }).expect(201)).body.data;
    expect(db.store.get('students')!.get(id)).toMatchObject({ admissionDate: '2026-09-14' });
    await as(owner).patch(`/api/v1/students/${id}`, { admissionDate: '2026-09-15' }).expect(200);
    const profile = (await as(owner).get(`/api/v1/students/${id}/profile`).expect(200)).body.data;
    expect(profile.student).toMatchObject({ admissionDate: '2026-09-15', photo: null });
  });

  it('reads the admission date from an imported file', async () => {
    const res = await as(owner).post('/api/v1/students/bulk-import', { records: [
      { firstName: 'Ada', lastName: 'One', admissionNumber: 'A/10', admissionDate: '14/09/2026' },
      { firstName: 'Bayo', lastName: 'Two', admissionNumber: 'A/11', admissionDate: 'sometime' },
      { firstName: 'Chi', lastName: 'Three', admissionNumber: 'A/12' },
    ] }).expect(201);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.errors).toEqual([{ row: 2, message: expect.stringMatching(/Admission date "sometime"/) }]);
    const byAdm = new Map([...db.store.get('students')!.values()].map((s: any) => [s.admissionNumber, s]));
    expect(byAdm.get('A/10')).toMatchObject({ admissionDate: '2026-09-14' });
    expect(byAdm.get('A/12')).toMatchObject({ admissionDate: null });
  });

  it('stores a photo: thumbnail on lists, ID cards and gate scans; full photo on the profile', async () => {
    await as(teacher).put('/api/v1/students/s1/photo', { photo: PHOTO, thumb: THUMB }).expect(403);
    await as(otherSchool).put('/api/v1/students/s1/photo', { photo: PHOTO, thumb: THUMB }).expect(404);
    await as(owner).put('/api/v1/students/s1/photo', { photo: 'data:text/html;base64,AAAA', thumb: THUMB }).expect(400);
    await as(owner).put('/api/v1/students/s1/photo', { photo: `data:image/jpeg;base64,${'A'.repeat(90_000)}`, thumb: THUMB }).expect(400);
    await as(owner).put('/api/v1/students/s1/photo', { photo: PHOTO, thumb: THUMB }).expect(200);

    const list = (await as(teacher).get('/api/v1/students').expect(200)).body.data;
    expect(list[0]).toMatchObject({ id: 's1', photoThumb: THUMB });
    expect(list[0].photo).toBeUndefined(); // the full photo never travels with the list
    expect((await as(teacher).get('/api/v1/students/s1/profile').expect(200)).body.data.student.photo).toBe(PHOTO);

    const cards = (await as(owner).get('/api/v1/gate/cards').expect(200)).body.data.cards;
    expect(cards[0]).toMatchObject({ studentId: 's1', photo: THUMB });
    const scan = (await as(teacher).post('/api/v1/gate/scan', { code: cards[0].qr }).expect(201)).body.data;
    expect(scan.student.photo).toBe(THUMB);

    // A field edit leaves the photo alone; removing it clears both copies.
    await as(owner).patch('/api/v1/students/s1', { address: 'Lekki' }).expect(200);
    expect(db.store.get('students')!.get('s1')).toMatchObject({ photoThumb: THUMB });
    await as(owner).del('/api/v1/students/s1/photo').expect(200);
    expect(db.store.get('students')!.get('s1')).toMatchObject({ photoThumb: null });
    expect(db.store.get('studentPhotos')?.get('s1')).toBeUndefined();
    expect((await as(owner).get('/api/v1/students/s1/profile').expect(200)).body.data.student.photo).toBeNull();
  });
});
