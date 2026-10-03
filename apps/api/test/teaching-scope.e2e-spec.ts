process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { schoolToday } from '../src/common/school-date';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub: string) => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId: 'school-a' }, process.env.JWT_SECRET!);

describe('Teachers limited to their own classes (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const as = (t: string) => ({
    get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
    put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
    patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
  });
  const owner = as(token('SCHOOL_OWNER', 'owner-1'));
  const ade = as(token('TEACHER', 'u-ade')); // teaches JSS1 Maths, form teacher of JSS2
  const unlinked = as(token('TEACHER', 'u-new'));
  const today = schoolToday();

  beforeEach(async () => {
    db = new FakeFirestore();
    db.seed('schools', 'school-a', { name: 'Greenfield' });
    db.seed('users', 'owner-1', { schoolId: 'school-a', role: 'SCHOOL_OWNER', status: 'ACTIVE', email: 'o@a.ng' });
    db.seed('users', 'u-ade', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', email: 'ade@a.ng', teacherId: 'tr-ade', firstName: 'Ade', lastName: 'Bello' });
    db.seed('users', 'u-new', { schoolId: 'school-a', role: 'TEACHER', status: 'ACTIVE', email: 'new@a.ng', teacherId: null });
    db.seed('teachers', 'tr-ade', { schoolId: 'school-a', firstName: 'Ade', lastName: 'Bello' });
    db.seed('teachers', 'tr-ola', { schoolId: 'school-a', firstName: 'Ola', lastName: 'Musa' });
    db.seed('classes', 'jss1', { schoolId: 'school-a', name: 'JSS1', status: 'ACTIVE', teacherId: 'tr-ola' });
    db.seed('classes', 'jss2', { schoolId: 'school-a', name: 'JSS2', status: 'ACTIVE', teacherId: 'tr-ade' });
    db.seed('classes', 'ss1', { schoolId: 'school-a', name: 'SS1', status: 'ACTIVE' });
    db.seed('teachingAssignments', 'a1', { schoolId: 'school-a', classId: 'jss1', subjectId: 'maths', teacherId: 'tr-ade' });
    db.seed('teachingAssignments', 'a2', { schoolId: 'school-a', classId: 'jss1', subjectId: 'eng', teacherId: 'tr-ola' });
    db.seed('students', 's1', { schoolId: 'school-a', firstName: 'A', lastName: 'One', classId: 'jss1', status: 'ACTIVE' });
    db.seed('students', 's2', { schoolId: 'school-a', firstName: 'B', lastName: 'Two', classId: 'jss2', status: 'ACTIVE' });
    db.seed('students', 's3', { schoolId: 'school-a', firstName: 'C', lastName: 'Three', classId: 'ss1', status: 'ACTIVE' });
    db.seed('examSeries', 'ser', { schoolId: 'school-a', name: 'First Term', term: 'FIRST', session: '2026/2027', classIds: ['jss1', 'jss2', 'ss1'], startDate: '2026-12-01', endDate: '2026-12-11' });
    const paper = (c: string, sub: string) => db.seed('exams', `ser__${c}__${sub}`, { schoolId: 'school-a', seriesId: 'ser', classId: c, subjectId: sub, title: sub, maxScore: 60 });
    paper('jss1', 'maths'); paper('jss1', 'eng'); paper('jss2', 'maths'); paper('ss1', 'maths');

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

  it('tells the web app what each person can work on', async () => {
    expect((await owner.get('/api/v1/teaching-assignments/mine').expect(200)).body.data).toMatchObject({ all: true, linked: true });
    const mine = (await ade.get('/api/v1/teaching-assignments/mine').expect(200)).body.data;
    expect(mine).toMatchObject({ all: false, linked: true, formClassIds: ['jss2'], subjects: [{ classId: 'jss1', subjectId: 'maths' }] });
    expect(mine.classIds.sort()).toEqual(['jss1', 'jss2']);
    expect((await unlinked.get('/api/v1/teaching-assignments/mine').expect(200)).body.data).toMatchObject({ all: false, linked: false, classIds: [] });
  });

  it('lets a teacher score only the subjects they teach, and view the classes they teach in', async () => {
    await ade.put('/api/v1/results/sheet', { examId: 'ser__jss1__maths', scores: [{ studentId: 's1', ca: 30, exam: 40 }] }).expect(200);
    const eng = await ade.put('/api/v1/results/sheet', { examId: 'ser__jss1__eng', scores: [{ studentId: 's1', exam: 40 }] }).expect(403);
    expect(eng.body.message).toMatch(/only enter scores for subjects you teach/);
    expect((await ade.get('/api/v1/results/sheet?examId=ser__jss1__eng').expect(200)).body.data.canEdit).toBe(false);
    expect((await ade.get('/api/v1/results/sheet?examId=ser__jss1__maths').expect(200)).body.data.canEdit).toBe(true);
    // Form teacher of JSS2 can view its sheets but only score subjects assigned to them.
    expect((await ade.get('/api/v1/results/sheet?examId=ser__jss2__maths').expect(200)).body.data.canEdit).toBe(false);
    await ade.get('/api/v1/results/sheet?examId=ser__ss1__maths').expect(403);
    const progress = (await ade.get('/api/v1/results/progress?seriesId=ser').expect(200)).body.data;
    expect(progress.map((p: any) => [p.examId, p.mine]).sort()).toEqual([['ser__jss1__eng', false], ['ser__jss1__maths', true], ['ser__jss2__maths', false]]);
    expect((await owner.get('/api/v1/results/progress?seriesId=ser').expect(200)).body.data).toHaveLength(4);
  });

  it('limits registers to classes the teacher teaches in or is form teacher of', async () => {
    await ade.put('/api/v1/attendance/register', { classId: 'jss2', date: today, marks: [{ studentId: 's2', status: 'PRESENT' }] }).expect(200);
    await ade.put('/api/v1/attendance/register', { classId: 'jss1', date: today, marks: [{ studentId: 's1', status: 'PRESENT' }] }).expect(200);
    await ade.put('/api/v1/attendance/register', { classId: 'ss1', date: today, marks: [{ studentId: 's3', status: 'PRESENT' }] }).expect(403);
    await ade.get(`/api/v1/attendance/register?classId=ss1&date=${today}`).expect(403);
    const overview = (await ade.get('/api/v1/attendance/today').expect(200)).body.data;
    expect(overview.classes.map((c: any) => c.name)).toEqual(['JSS1', 'JSS2']);
    // Correcting a single mark follows the same rule.
    await owner.put('/api/v1/attendance/register', { classId: 'ss1', date: today, marks: [{ studentId: 's3', status: 'PRESENT' }] }).expect(200);
    const markId = [...db.store.get('attendance')!.entries()].find(([, m]) => m.studentId === 's3')![0];
    await ade.patch(`/api/v1/attendance/${markId}`, { status: 'ABSENT' }).expect(403);
  });

  it('lets only the form teacher write the class teacher’s remark', async () => {
    const rc = (await ade.get('/api/v1/report-cards?seriesId=ser&classId=jss1').expect(200)).body.data;
    expect(rc.canRemark).toBe(false);
    await ade.put('/api/v1/report-cards/remarks', { seriesId: 'ser', studentId: 's1', teacherRemark: 'Good' }).expect(403);
    expect((await ade.get('/api/v1/report-cards?seriesId=ser&classId=jss2').expect(200)).body.data.canRemark).toBe(true);
    await ade.put('/api/v1/report-cards/remarks', { seriesId: 'ser', studentId: 's2', teacherRemark: 'Very good' }).expect(200);
    await ade.get('/api/v1/report-cards?seriesId=ser&classId=ss1').expect(403);
  });

  it('asks unlinked teachers to get linked, and admins can link them', async () => {
    const res = await unlinked.put('/api/v1/attendance/register', { classId: 'jss1', date: today, marks: [{ studentId: 's1', status: 'PRESENT' }] }).expect(403);
    expect(res.body.message).toMatch(/isn't linked to a teacher record/);
    await owner.patch('/api/v1/staff/u-new/teacher', { teacherId: 'tr-ade' }).expect(400); // already linked to Ade
    await owner.patch('/api/v1/staff/u-new/teacher', { teacherId: 'tr-ola' }).expect(200);
    await unlinked.put('/api/v1/attendance/register', { classId: 'jss1', date: today, marks: [{ studentId: 's1', status: 'PRESENT' }] }).expect(200);
    await owner.patch('/api/v1/staff/owner-1/teacher', { teacherId: 'tr-ola' }).expect(400);
  });
});
