process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { DEFAULT_SETUP } from '../src/modules/timetable/timetable.service';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub: string) => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId: 'school-a' }, process.env.JWT_SECRET!);

describe('Class timetables (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const owner = as(token('SCHOOL_OWNER', 'owner-1'));
  const set = (classId: string, day: string, periodId: string, subjectId: string | null) => owner.put(`/api/v1/timetable/class/${classId}/slot`, { day, periodId, subjectId });

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('schools', 'school-a', { name: 'Greenfield' });
    db.seed('users', 'u-ade', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', teacherId: 'tr-ade' });
    db.seed('users', 'u-new', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', teacherId: null });
    db.seed('teachers', 'tr-ade', { schoolId: 'school-a', firstName: 'Ade', lastName: 'Bello' });
    db.seed('teachers', 'tr-ola', { schoolId: 'school-a', firstName: 'Ola', lastName: 'Musa' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE' });
    db.seed('subjects', 'maths', { schoolId: 'school-a', name: 'Mathematics', status: 'ACTIVE' });
    db.seed('subjects', 'eng', { schoolId: 'school-a', name: 'English Language', status: 'ACTIVE' });
    db.seed('subjects', 'bsc', { schoolId: 'school-a', name: 'Basic Science', status: 'ACTIVE' });
    db.seed('teachingAssignments', 'a1', { schoolId: 'school-a', classId: 'jss1', subjectId: 'maths', teacherId: 'tr-ade' });
    db.seed('teachingAssignments', 'a2', { schoolId: 'school-a', classId: 'jss1', subjectId: 'eng', teacherId: 'tr-ola' });
    db.seed('teachingAssignments', 'a3', { schoolId: 'school-a', classId: 'jss2', subjectId: 'maths', teacherId: 'tr-ade' });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FirebaseService).useValue({ firestore: db }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  it('starts with a sensible school day and lets admins change it', async () => {
    expect((await owner.get('/api/v1/timetable/setup').expect(200)).body.data).toEqual(DEFAULT_SETUP);
    const periods = [
      { id: 'p1', label: 'Period 1', start: '08:00', end: '08:45', kind: 'LESSON' },
      { id: 'b1', label: 'Break', start: '08:45', end: '09:00', kind: 'BREAK' },
      { id: 'p2', label: 'Period 2', start: '09:00', end: '09:45', kind: 'LESSON' },
    ];
    await owner.put('/api/v1/timetable/setup', { days: ['MON', 'TUE'], periods: [periods[0], { ...periods[2], start: '08:30' }] }).expect(400); // overlap
    await owner.put('/api/v1/timetable/setup', { days: ['MON', 'TUE'], periods: [{ ...periods[0], end: '07:00' }] }).expect(400);
    await owner.put('/api/v1/timetable/setup', { days: ['FUNDAY'], periods }).expect(400);
    expect((await owner.put('/api/v1/timetable/setup', { days: ['TUE', 'MON'], periods }).expect(200)).body.data.days).toEqual(['MON', 'TUE']);
    await as(token('TEACHER', 'u-ade')).put('/api/v1/timetable/setup', { days: ['MON'], periods }).expect(403);
  });

  it('builds a class week from its subjects and counts periods per subject', async () => {
    await set('jss1', 'MON', 'p1', 'maths').expect(200);
    await set('jss1', 'TUE', 'p1', 'maths').expect(200);
    await set('jss1', 'MON', 'p2', 'eng').expect(200);
    expect((await set('jss1', 'MON', 'p3', 'bsc').expect(400)).body.message).toMatch(/doesn't take that subject/);
    expect((await set('jss1', 'MON', 'b1', 'maths').expect(400)).body.message).toMatch(/is a break/);
    await set('jss1', 'SAT', 'p1', 'maths').expect(400);
    const week = (await owner.get('/api/v1/timetable/class/jss1').expect(200)).body.data;
    expect(week).toMatchObject({ filled: 3, total: 40, clashes: [] });
    expect(week.subjects.map((s: any) => [s.subject, s.periods, s.teacherName])).toEqual([['English Language', 1, 'Ola Musa'], ['Mathematics', 2, 'Ade Bello']]);
    await set('jss1', 'TUE', 'p1', null).expect(200);
    expect((await owner.get('/api/v1/timetable/class/jss1').expect(200)).body.data.filled).toBe(2);
  });

  it('flags a teacher booked in two classes at once', async () => {
    await set('jss1', 'WED', 'p4', 'maths').expect(200);
    const res = (await set('jss2', 'WED', 'p4', 'maths').expect(200)).body.data;
    expect(res.clash).toMatchObject({ teacherName: 'Ade Bello', day: 'WED', periodId: 'p4' });
    expect(res.clash.lessons.map((l: any) => l.className).sort()).toEqual(['JSS1', 'JSS2']);
    const overview = (await owner.get('/api/v1/timetable/overview').expect(200)).body.data;
    expect(overview.clashes).toHaveLength(1);
    expect((await owner.get('/api/v1/timetable/class/jss1').expect(200)).body.data.lessons[0].clash).toBe(true);
  });

  it('shows a teacher their own week, and refuses removing periods in use', async () => {
    await set('jss1', 'MON', 'p1', 'maths').expect(200);
    await set('jss2', 'TUE', 'p2', 'maths').expect(200);
    const mine = (await as(token('TEACHER', 'u-ade')).get('/api/v1/timetable/mine').expect(200)).body.data;
    expect(mine).toMatchObject({ teacher: { name: 'Ade Bello' }, periodsPerWeek: 2 });
    expect(mine.lessons.map((l: any) => `${l.day} ${l.periodId} ${l.className}`).sort()).toEqual(['MON p1 JSS1', 'TUE p2 JSS2']);
    await as(token('TEACHER', 'u-new')).get('/api/v1/timetable/mine').expect(404);
    await as(token('TEACHER', 'u-ade')).put('/api/v1/timetable/class/jss1/slot', { day: 'MON', periodId: 'p2', subjectId: 'maths' }).expect(403);
    const res = await owner.put('/api/v1/timetable/setup', { days: ['MON'], periods: DEFAULT_SETUP.periods }).expect(400);
    expect(res.body.message).toMatch(/1 lesson is placed/);
    await as(token('ACCOUNTANT', 'acc')).get('/api/v1/timetable/class/jss1').expect(200);
    await as(token('PARENT', 'p')).get('/api/v1/timetable/class/jss1').expect(403);
  });
});
