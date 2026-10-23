process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { forgetBilling } from '../src/modules/auth/guards/jwt-auth.guard';
import { schoolToday } from '../src/common/school-date';
import { FakeFirestore } from './fake-firestore';

const token = (role: string, sub: string, schoolId = 'school-a') => jwt.sign({ sub, email: `${sub}@a.ng`, role, schoolId }, process.env.JWT_SECRET!);

describe('Payroll: pay details, monthly runs, approval, payments and payslips (e2e)', () => {
  let app: INestApplication;
  let db: FakeFirestore;
  let http: ReturnType<typeof request>;
  const MONTH = schoolToday().slice(0, 7);
  const as = (role: string, sub: string) => {
    const t = token(role, sub);
    return {
      get: (u: string) => http.get(u).set('Authorization', `Bearer ${t}`),
      post: (u: string, b: object = {}) => http.post(u).set('Authorization', `Bearer ${t}`).send(b),
      put: (u: string, b: object) => http.put(u).set('Authorization', `Bearer ${t}`).send(b),
      patch: (u: string, b: object) => http.patch(u).set('Authorization', `Bearer ${t}`).send(b),
      del: (u: string) => http.delete(u).set('Authorization', `Bearer ${t}`),
    };
  };
  const owner = as('SCHOOL_OWNER', 'owner');
  const principal = as('PRINCIPAL', 'principal');
  const accountant = as('ACCOUNTANT', 'acct');
  const teacher = as('TEACHER', 'tuser');
  const vp = as('VICE_PRINCIPAL', 'vp');
  const P = '/api/v1/payroll';

  beforeEach(async () => {
    db = new FakeFirestore();
    forgetBilling('school-a');
    db.seed('schools', 'school-a', { name: 'Greenfield', createdAt: new Date() });
    const user = (id: string, role: string, extra: object = {}) => db.seed('users', id, { schoolId: 'school-a', role, status: 'ACTIVE', firstName: id, lastName: 'X', email: `${id}@a.ng`, ...extra });
    user('owner', 'SCHOOL_OWNER');
    user('principal', 'PRINCIPAL');
    user('acct', 'ACCOUNTANT');
    user('vp', 'VICE_PRINCIPAL');
    user('tuser', 'TEACHER', { teacherId: 't1' });
    user('tuser2', 'TEACHER', { teacherId: 't2' });
    db.seed('teachers', 't1', { schoolId: 'school-a', firstName: 'Ngozi', lastName: 'Okeke', employeeNumber: 'E-1', email: 'ngozi@a.ng', salary: 150000, status: 'ACTIVE' });
    db.seed('teachers', 't2', { schoolId: 'school-a', firstName: 'Ibrahim', lastName: 'Musa', employeeNumber: 'E-2', email: 'ib@a.ng', salary: 120000, status: 'ACTIVE' });
    // Late arrivals at the gate: three this month for Ngozi, one last year.
    for (const d of ['01', '02', '03']) db.seed('staffClock', `school-a__${MONTH}-${d}__T_t1`, { schoolId: 'school-a', date: `${MONTH}-${d}`, staffKey: 'T_t1', late: true });
    db.seed('staffClock', 'old', { schoolId: 'school-a', date: '2020-01-05', staffKey: 'T_t1', late: true });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FirebaseService).useValue({ firestore: db }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterEach(() => app.close());

  it('keeps pay to the owner, principal and accountant, and pay details in step with the teacher record', async () => {
    await teacher.get(`${P}/people`).expect(403);
    await vp.get(`${P}/people`).expect(403);
    const people = (await accountant.get(`${P}/people`).expect(200)).body.data;
    expect(people.find((p: any) => p.key === 'T_t1')).toMatchObject({ basic: 150000, gross: 150000 });

    await accountant.put(`${P}/people/T_t1`, { basic: 160000, allowances: [{ label: 'Transport', amount: 20000 }], deductions: [{ label: 'Pension', amount: 12800 }], bankName: 'GTBank', accountNumber: '01234', accountName: 'Ngozi Okeke' }).expect(400);
    const saved = (await accountant.put(`${P}/people/T_t1`, { basic: 160000, allowances: [{ label: 'Transport', amount: 20000 }, { label: '', amount: 5 }], deductions: [{ label: 'Pension', amount: 12800 }], bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ngozi Okeke' }).expect(200)).body.data;
    expect(saved).toMatchObject({ basic: 160000, gross: 180000, net: 167200, allowances: [{ label: 'Transport', amount: 20000 }] });
    expect(db.store.get('teachers')!.get('t1')).toMatchObject({ salary: 160000 }); // one source for a teacher's basic pay

    // Other staff join the roster: pay, ID cards and the gate.
    const guard = (await owner.post(`${P}/other-staff`, { firstName: 'Musa', lastName: 'Bello', role: 'Security' }).expect(201)).body.data;
    await owner.put(`${P}/people/${guard.key}`, { basic: 60000, allowances: [], deductions: [] }).expect(200);
    const cards = (await owner.get('/api/v1/gate/staff-cards').expect(200)).body.data.cards;
    expect(cards.find((c: any) => c.key === guard.key)).toMatchObject({ role: 'Security' });
    await teacher.post(`${P}/other-staff`, { firstName: 'A', lastName: 'B', role: 'Cook' }).expect(403);
  });

  it('runs a month: lateness, one-off items, approval by the owner or principal, payments and payslips', async () => {
    await owner.put(`${P}/settings`, { latePenalty: 500, freeLates: 1 }).expect(200);
    await accountant.put(`${P}/people/T_t1`, { basic: 150000, allowances: [{ label: 'Transport', amount: 20000 }], deductions: [{ label: 'Pension', amount: 12000 }], bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ngozi Okeke' }).expect(200);

    let run = (await accountant.post(`${P}/runs`, { month: MONTH }).expect(201)).body.data;
    await accountant.post(`${P}/runs`, { month: MONTH }).expect(409);
    const line = (r: any, key: string) => r.lines.find((l: any) => l.key === key);
    // 3 late days, 1 free: 2 × ₦500.
    expect(line(run, 'T_t1')).toMatchObject({ gross: 170000, lateDays: 3, lateDeduction: 1000, totalDeductions: 13000, net: 157000, excluded: false });
    expect(line(run, 'T_t2')).toMatchObject({ gross: 120000, net: 120000 });
    expect(line(run, 'U_owner')).toMatchObject({ gross: 0, excluded: true }); // no pay set: left out
    expect(run).toMatchObject({ status: 'DRAFT', people: 2, net: 277000 });

    run = (await accountant.patch(`${P}/runs/${MONTH}/lines/T_t2`, { extraPay: [{ label: 'Exam bonus', amount: 10000 }], extraDeductions: [{ label: 'Salary advance', amount: 30000 }] }).expect(200)).body.data;
    expect(line(run, 'T_t2')).toMatchObject({ gross: 130000, totalDeductions: 30000, net: 100000 });
    run = (await accountant.patch(`${P}/runs/${MONTH}/lines/T_t1`, { waiveLateness: true }).expect(200)).body.data;
    expect(line(run, 'T_t1')).toMatchObject({ lateDeduction: 0, net: 158000 });
    // Rebuilding picks up new pay details but keeps one-off items and waivers.
    await accountant.put(`${P}/people/T_t2`, { basic: 125000, allowances: [], deductions: [] }).expect(200);
    run = (await accountant.post(`${P}/runs/${MONTH}/rebuild`).expect(201)).body.data;
    expect(line(run, 'T_t2')).toMatchObject({ basic: 125000, gross: 135000, net: 105000 });
    expect(line(run, 'T_t1')).toMatchObject({ waiveLateness: true, lateDeduction: 0 });

    // Nothing is paid before approval, and the accountant who prepared it can't approve it.
    await accountant.post(`${P}/runs/${MONTH}/pay`, { paidOn: schoolToday(), method: 'TRANSFER' }).expect(400);
    await accountant.post(`${P}/runs/${MONTH}/approve`).expect(403);
    run = (await principal.post(`${P}/runs/${MONTH}/approve`).expect(201)).body.data;
    expect(run).toMatchObject({ status: 'APPROVED', approvedByName: 'principal X' });
    await accountant.patch(`${P}/runs/${MONTH}/lines/T_t2`, { excluded: true }).expect(400); // locked once approved

    // Payslips: each teacher sees only their own, and only once approved.
    const mine = (await teacher.get(`${P}/my-payslips`).expect(200)).body.data.payslips;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ month: MONTH, line: { key: 'T_t1', net: 158000 } });

    run = (await accountant.post(`${P}/runs/${MONTH}/pay`, { keys: ['T_t1'], paidOn: schoolToday(), method: 'TRANSFER', reference: 'GTB-778' }).expect(201)).body.data;
    expect(line(run, 'T_t1').paid).toMatchObject({ method: 'TRANSFER', reference: 'GTB-778' });
    expect(run).toMatchObject({ paidCount: 1, paidAmount: 158000 });
    await owner.post(`${P}/runs/${MONTH}/reopen`).expect(400); // someone is already paid
    await accountant.post(`${P}/runs/${MONTH}/lines/T_t1/unpay`).expect(403);
    await owner.post(`${P}/runs/${MONTH}/lines/T_t1/unpay`).expect(201);
    run = (await accountant.post(`${P}/runs/${MONTH}/pay`, { paidOn: schoolToday(), method: 'CASH' }).expect(201)).body.data;
    expect(run).toMatchObject({ paidCount: 2 });
    await accountant.post(`${P}/runs/${MONTH}/pay`, { paidOn: schoolToday(), method: 'CASH' }).expect(400); // everyone paid

    const list = (await accountant.get(`${P}/runs`).expect(200)).body.data;
    expect(list).toEqual([expect.objectContaining({ month: MONTH, status: 'APPROVED', people: 2, paidCount: 2 })]);
  });

  it('refuses months too far ahead, deductions above pay, and other schools', async () => {
    await accountant.post(`${P}/runs`, { month: '2099-01' }).expect(400);
    await accountant.post(`${P}/runs`, { month: '2026-13' }).expect(400);
    await accountant.post(`${P}/runs`, { month: MONTH }).expect(201);
    await accountant.patch(`${P}/runs/${MONTH}/lines/T_t2`, { extraDeductions: [{ label: 'Loan', amount: 500000 }] }).expect(200);
    expect((await owner.post(`${P}/runs/${MONTH}/approve`).expect(400)).body.message).toMatch(/Deductions are more than the pay for Ibrahim Musa/);

    const other = { get: (u: string) => http.get(u).set('Authorization', `Bearer ${token('SCHOOL_OWNER', 'ob', 'school-b')}`) };
    forgetBilling('school-b');
    db.seed('schools', 'school-b', { name: 'Other', createdAt: new Date() });
    db.seed('users', 'ob', { schoolId: 'school-b', role: 'SCHOOL_OWNER', status: 'ACTIVE', email: 'ob@b.ng' });
    await other.get(`${P}/runs/${MONTH}`).expect(404);
    await owner.put(`${P}/people/T_tb`, { basic: 1, allowances: [], deductions: [] }).expect(404);
    await owner.put(`${P}/people/..%2Fx`, { basic: 1, allowances: [], deductions: [] }).expect(403);
  });
});
