import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { schoolToday } from '../../common/school-date';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { mailEnabled, sendMail } from '../../common/mailer';
import { StaffClockService, StaffMember, isStaffKey } from '../gate/staff-clock.service';

export interface PayItem { label: string; amount: number }
export type PayMethod = 'TRANSFER' | 'CASH' | 'CHEQUE';

/** One person's pay in a month's payroll. Amounts are naira. */
export interface PayLine {
  key: string;
  name: string;
  role: string;
  number: string;
  email: string;
  basic: number;
  allowances: PayItem[];
  deductions: PayItem[];
  extraPay: PayItem[];
  extraDeductions: PayItem[];
  lateDays: number;
  lateDeduction: number;
  waiveLateness: boolean;
  excluded: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
  gross: number;
  totalDeductions: number;
  net: number;
  paid: { on: string; method: PayMethod; reference: string | null; by: string; at: Date } | null;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const round = (n: number) => Math.round(n * 100) / 100;
const sum = (items: PayItem[]) => round(items.reduce((a, i) => a + i.amount, 0));
const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Works out a line's totals from its parts. Lateness is charged on late days beyond the free ones, unless waived. */
function priced(line: Omit<PayLine, 'gross' | 'totalDeductions' | 'net' | 'lateDeduction'>, perLate: number | null, freeLates: number): PayLine {
  const lateDeduction = !perLate || line.waiveLateness ? 0 : round(Math.max(0, line.lateDays - freeLates) * perLate);
  const gross = round(line.basic + sum(line.allowances) + sum(line.extraPay));
  const totalDeductions = round(sum(line.deductions) + sum(line.extraDeductions) + lateDeduction);
  return { ...line, lateDeduction, gross, totalDeductions, net: round(gross - totalDeductions) };
}

/**
 * Monthly payroll: each staff member's pay details, a month's run (draft → approved → paid),
 * payslips, and the lateness deduction from the gate's staff clock-ins.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly staff: StaffClockService,
  ) {}

  private get db() {
    return this.firebase.firestore;
  }

  private profileRef = (schoolId: string, key: string) => this.db.collection('payProfiles').doc(`${schoolId}__${key}`);
  private runRef = (schoolId: string, month: string) => this.db.collection('payrollRuns').doc(`${schoolId}__${month}`);

  // ---------- Settings ----------

  async settings(schoolId: string) {
    const p = (await this.db.collection('schools').doc(schoolId).get()).data()?.payroll ?? {};
    return { latePenalty: (p.latePenalty as number | null) ?? null, freeLates: (p.freeLates as number | undefined) ?? 0 };
  }

  async saveSettings(schoolId: string, latePenalty: number | null, freeLates: number) {
    if (latePenalty !== null && (!Number.isFinite(latePenalty) || latePenalty < 0 || latePenalty > 1_000_000)) throw new BadRequestException('Enter the amount per late day, like 500.');
    if (!Number.isInteger(freeLates) || freeLates < 0 || freeLates > 31) throw new BadRequestException('Free late days must be a whole number from 0 to 31.');
    await this.db.collection('schools').doc(schoolId).update({ payroll: { latePenalty: latePenalty ? round(latePenalty) : null, freeLates } });
    return this.settings(schoolId);
  }

  // ---------- Pay details ----------

  /** Everyone on the staff roster with their pay details. A teacher's basic pay is the salary on their teacher record. */
  async people(schoolId: string) {
    const [roster, profiles, teachers] = await Promise.all([
      this.staff.roster(schoolId),
      this.db.collection('payProfiles').where('schoolId', '==', schoolId).get(),
      this.db.collection('teachers').where('schoolId', '==', schoolId).get(),
    ]);
    const byKey = new Map(profiles.docs.map((d) => [d.data().staffKey as string, d.data()]));
    const salary = new Map(teachers.docs.map((d) => [`T_${d.id}`, Number(d.data().salary) || 0]));
    return roster.map((p) => this.withPay(p, byKey.get(p.key), salary.get(p.key)));
  }

  private withPay(p: StaffMember, profile: FirebaseFirestore.DocumentData | undefined, teacherSalary: number | undefined) {
    const basic = p.key.startsWith('T_') ? teacherSalary ?? 0 : Number(profile?.basic) || 0;
    const allowances: PayItem[] = profile?.allowances ?? [];
    const deductions: PayItem[] = profile?.deductions ?? [];
    const gross = round(basic + sum(allowances));
    return {
      ...p, basic, allowances, deductions,
      bankName: profile?.bankName ?? '', accountNumber: profile?.accountNumber ?? '', accountName: profile?.accountName ?? '',
      gross, net: round(gross - sum(deductions)),
    };
  }

  async savePerson(schoolId: string, key: string, dto: { basic: number; allowances: PayItem[]; deductions: PayItem[]; bankName?: string; accountNumber?: string; accountName?: string }) {
    const person = await this.staff.member(schoolId, key);
    if (!person) throw new NotFoundException('Staff member not found');
    const clean = (items: PayItem[]) => items.map((i) => ({ label: i.label.trim(), amount: round(i.amount) })).filter((i) => i.label && i.amount > 0);
    const accountNumber = (dto.accountNumber ?? '').replace(/\s/g, '');
    if (accountNumber && !/^\d{10}$/.test(accountNumber)) throw new BadRequestException('A Nigerian account number (NUBAN) has 10 digits.');
    const now = new Date();
    const profile = {
      schoolId, staffKey: key,
      allowances: clean(dto.allowances), deductions: clean(dto.deductions),
      bankName: (dto.bankName ?? '').trim(), accountNumber, accountName: (dto.accountName ?? '').trim(),
      updatedAt: now,
      // A teacher's basic pay stays on their teacher record, so the Teachers page and payroll agree.
      ...(key.startsWith('T_') ? {} : { basic: round(dto.basic) }),
    };
    if (key.startsWith('T_')) await this.db.collection('teachers').doc(key.slice(2)).update({ salary: round(dto.basic), updatedAt: now });
    await this.profileRef(schoolId, key).set(profile);
    return this.withPay(person, profile, round(dto.basic));
  }

  // ---------- Runs ----------

  /** Days in a month a staff member clocked in late, from the gate. */
  private async lateDays(schoolId: string, month: string) {
    const snap = await this.db.collection('staffClock').where('schoolId', '==', schoolId).where('late', '==', true).get();
    const days = new Map<string, number>();
    for (const d of snap.docs) {
      const c = d.data();
      if (String(c.date ?? '').startsWith(`${month}-`)) days.set(c.staffKey, (days.get(c.staffKey) ?? 0) + 1);
    }
    return days;
  }

  /** Fresh lines from today's pay details, keeping any one-off items, waivers and exclusions already made. */
  private async buildLines(schoolId: string, month: string, previous: PayLine[] = []) {
    const [people, late, s] = await Promise.all([this.people(schoolId), this.lateDays(schoolId, month), this.settings(schoolId)]);
    const before = new Map(previous.map((l) => [l.key, l]));
    return people.map((p) => {
      const was = before.get(p.key);
      return priced({
        key: p.key, name: `${p.firstName} ${p.lastName}`.trim(), role: p.role, number: p.number, email: p.email,
        basic: p.basic, allowances: p.allowances, deductions: p.deductions,
        extraPay: was?.extraPay ?? [], extraDeductions: was?.extraDeductions ?? [],
        lateDays: late.get(p.key) ?? 0, waiveLateness: was?.waiveLateness ?? false,
        // Someone with no pay set yet is left out until their pay is added.
        excluded: was ? was.excluded : p.gross <= 0,
        bankName: p.bankName, accountNumber: p.accountNumber, accountName: p.accountName,
        paid: null,
      }, s.latePenalty, s.freeLates);
    });
  }

  private summary(month: string, r: FirebaseFirestore.DocumentData) {
    const lines = (r.lines as PayLine[]).filter((l) => !l.excluded);
    return {
      month, label: monthName(month), status: r.status as 'DRAFT' | 'APPROVED',
      people: lines.length,
      gross: round(lines.reduce((a, l) => a + l.gross, 0)),
      deductions: round(lines.reduce((a, l) => a + l.totalDeductions, 0)),
      net: round(lines.reduce((a, l) => a + l.net, 0)),
      paidCount: lines.filter((l) => l.paid).length,
      paidAmount: round(lines.filter((l) => l.paid).reduce((a, l) => a + l.net, 0)),
    };
  }

  async runs(schoolId: string) {
    const snap = await this.db.collection('payrollRuns').where('schoolId', '==', schoolId).get();
    return snap.docs.map((d) => this.summary(d.data().month, d.data())).sort((a, b) => b.month.localeCompare(a.month));
  }

  private checkMonth(month: string) {
    if (!MONTH.test(month)) throw new BadRequestException('Use a month like 2026-10.');
    const [y, m] = schoolToday().split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    if (month > next) throw new BadRequestException("Payroll can be prepared up to next month, not further ahead.");
  }

  private async loadRun(schoolId: string, month: string) {
    this.checkMonth(month);
    const snap = await this.runRef(schoolId, month).get();
    if (!snap.exists) throw new NotFoundException(`There is no payroll for ${monthName(month)} yet.`);
    return snap;
  }

  async run(schoolId: string, month: string) {
    const snap = await this.loadRun(schoolId, month);
    const r = snap.data()!;
    const school = (await this.db.collection('schools').doc(schoolId).get()).data() ?? {};
    return {
      ...this.summary(month, r),
      createdByName: r.createdByName ?? null, approvedByName: r.approvedByName ?? null, approvedAt: r.approvedAt ?? null,
      settings: await this.settings(schoolId),
      school: { name: school.name ?? '', logo: school.logo ?? null, address: school.address ?? '', phone: school.phone ?? '', email: school.email ?? '' },
      lines: r.lines as PayLine[],
    };
  }

  private async nameOf(user: JwtPayload) {
    const u = (await this.db.collection('users').doc(user.sub).get()).data();
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email : user.email;
  }

  async create(schoolId: string, user: JwtPayload, month: string) {
    this.checkMonth(month);
    const ref = this.runRef(schoolId, month);
    if ((await ref.get()).exists) throw new ConflictException(`Payroll for ${monthName(month)} has already been started.`);
    const now = new Date();
    await ref.set({ schoolId, month, status: 'DRAFT', lines: await this.buildLines(schoolId, month), createdAt: now, createdBy: user.sub, createdByName: await this.nameOf(user), updatedAt: now });
    return this.run(schoolId, month);
  }

  private async draft(schoolId: string, month: string) {
    const snap = await this.loadRun(schoolId, month);
    if (snap.data()!.status !== 'DRAFT') throw new BadRequestException('This payroll is approved. Ask the owner or principal to reopen it before making changes.');
    return snap;
  }

  /** Re-reads everyone's pay details and late days into a draft; one-off items and waivers are kept. */
  async rebuild(schoolId: string, month: string) {
    const snap = await this.draft(schoolId, month);
    await snap.ref.update({ lines: await this.buildLines(schoolId, month, snap.data()!.lines), updatedAt: new Date() });
    return this.run(schoolId, month);
  }

  async editLine(schoolId: string, month: string, key: string, dto: { extraPay?: PayItem[]; extraDeductions?: PayItem[]; waiveLateness?: boolean; excluded?: boolean }) {
    const snap = await this.draft(schoolId, month);
    const lines = snap.data()!.lines as PayLine[];
    const i = lines.findIndex((l) => l.key === key);
    if (i < 0) throw new NotFoundException('This person is not on this payroll.');
    const clean = (items: PayItem[]) => items.map((x) => ({ label: x.label.trim(), amount: round(x.amount) })).filter((x) => x.label && x.amount > 0);
    const s = await this.settings(schoolId);
    lines[i] = priced({
      ...lines[i],
      ...(dto.extraPay ? { extraPay: clean(dto.extraPay) } : {}),
      ...(dto.extraDeductions ? { extraDeductions: clean(dto.extraDeductions) } : {}),
      ...(dto.waiveLateness !== undefined ? { waiveLateness: dto.waiveLateness } : {}),
      ...(dto.excluded !== undefined ? { excluded: dto.excluded } : {}),
    }, s.latePenalty, s.freeLates);
    await snap.ref.update({ lines, updatedAt: new Date() });
    return this.run(schoolId, month);
  }

  async approve(schoolId: string, user: JwtPayload, month: string) {
    const snap = await this.draft(schoolId, month);
    const lines = (snap.data()!.lines as PayLine[]).filter((l) => !l.excluded);
    if (!lines.length) throw new BadRequestException('Nobody is included in this payroll. Add pay details on the Pay details tab first.');
    const negative = lines.filter((l) => l.net < 0);
    if (negative.length) throw new BadRequestException(`Deductions are more than the pay for ${negative.map((l) => l.name).join(', ')}. Adjust ${negative.length === 1 ? 'it' : 'them'} first.`);
    await snap.ref.update({ status: 'APPROVED', approvedAt: new Date(), approvedBy: user.sub, approvedByName: await this.nameOf(user), updatedAt: new Date() });
    return this.run(schoolId, month);
  }

  async reopen(schoolId: string, month: string) {
    const snap = await this.loadRun(schoolId, month);
    if (snap.data()!.status !== 'APPROVED') throw new BadRequestException('This payroll is still a draft.');
    if ((snap.data()!.lines as PayLine[]).some((l) => l.paid)) throw new BadRequestException('Some people have already been marked paid. Undo those payments first.');
    await snap.ref.update({ status: 'DRAFT', approvedAt: null, approvedBy: null, approvedByName: null, updatedAt: new Date() });
    return this.run(schoolId, month);
  }

  async remove(schoolId: string, month: string) {
    const snap = await this.draft(schoolId, month);
    await snap.ref.delete();
    return { month, deleted: true };
  }

  /** Records that people were paid (all unpaid ones when no keys are given). Only an approved payroll can be paid. */
  async markPaid(schoolId: string, user: JwtPayload, month: string, dto: { keys?: string[]; paidOn: string; method: PayMethod; reference?: string }) {
    const snap = await this.loadRun(schoolId, month);
    if (snap.data()!.status !== 'APPROVED') throw new BadRequestException('Approve this payroll before recording payments.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.paidOn) || dto.paidOn > schoolToday()) throw new BadRequestException("Use the date the money was sent; it can't be in the future.");
    const lines = snap.data()!.lines as PayLine[];
    const wanted = dto.keys?.length ? new Set(dto.keys) : null;
    const now = new Date();
    let marked = 0;
    for (const l of lines) {
      if (l.excluded || l.paid || (wanted && !wanted.has(l.key))) continue;
      l.paid = { on: dto.paidOn, method: dto.method, reference: dto.reference?.trim() || null, by: user.sub, at: now };
      marked++;
    }
    if (!marked) throw new BadRequestException('Everyone selected has already been marked paid.');
    await snap.ref.update({ lines, updatedAt: now });
    return this.run(schoolId, month);
  }

  async unpay(schoolId: string, month: string, key: string) {
    const snap = await this.loadRun(schoolId, month);
    const lines = snap.data()!.lines as PayLine[];
    const line = lines.find((l) => l.key === key);
    if (!line?.paid) throw new BadRequestException('This person is not marked paid.');
    line.paid = null;
    await snap.ref.update({ lines, updatedAt: new Date() });
    return this.run(schoolId, month);
  }

  // ---------- Payslips ----------

  /** Emails each included person their payslip for an approved month. */
  async emailPayslips(schoolId: string, month: string, keys?: string[]) {
    if (!mailEnabled()) throw new BadRequestException("Email isn't set up on this server yet.");
    const run = await this.run(schoolId, month);
    if (run.status !== 'APPROVED') throw new BadRequestException('Approve this payroll before sending payslips.');
    const wanted = keys?.length ? new Set(keys) : null;
    const result = { sent: 0, noEmail: [] as string[], failed: [] as string[] };
    for (const l of run.lines) {
      if (l.excluded || (wanted && !wanted.has(l.key))) continue;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email)) { result.noEmail.push(l.name); continue; }
      const { text, html } = this.payslipEmail(run.school.name, run.label, l);
      (await sendMail(l.email, `Your payslip for ${run.label} · ${run.school.name}`, text, html)) ? result.sent++ : result.failed.push(l.name);
    }
    return result;
  }

  private payslipEmail(school: string, label: string, l: PayLine) {
    const rows: [string, number][] = [
      ['Basic pay', l.basic],
      ...l.allowances.map((a) => [a.label, a.amount] as [string, number]),
      ...l.extraPay.map((a) => [a.label, a.amount] as [string, number]),
    ];
    const less: [string, number][] = [
      ...l.deductions.map((d) => [d.label, d.amount] as [string, number]),
      ...l.extraDeductions.map((d) => [d.label, d.amount] as [string, number]),
      ...(l.lateDeduction ? [[`Lateness (${l.lateDays} late ${l.lateDays === 1 ? 'day' : 'days'})`, l.lateDeduction] as [string, number]] : []),
    ];
    const text = [
      `${school} · Payslip for ${label}`, '', `${l.name}${l.role ? ` · ${l.role}` : ''}`, '',
      ...rows.map(([k, v]) => `${k}: ${naira(v)}`), `Gross pay: ${naira(l.gross)}`, '',
      ...less.map(([k, v]) => `${k}: -${naira(v)}`), `Total deductions: ${naira(l.totalDeductions)}`, '',
      `Net pay: ${naira(l.net)}`,
    ].join('\n');
    const tr = (k: string, v: string, bold = false) => `<tr><td style="padding:6px 0;${bold ? 'font-weight:700;' : ''}">${escape(k)}</td><td style="padding:6px 0;text-align:right;${bold ? 'font-weight:700;' : ''}">${v}</td></tr>`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f2a24">
      <h2 style="margin:0 0 4px">${escape(school)}</h2><p style="margin:0 0 16px;color:#5f6a63">Payslip for ${escape(label)}</p>
      <p style="margin:0 0 12px"><b>${escape(l.name)}</b>${l.role ? ` · ${escape(l.role)}` : ''}${l.number ? ` · ${escape(l.number)}` : ''}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows.map(([k, v]) => tr(k, naira(v))).join('')}${tr('Gross pay', naira(l.gross), true)}
        ${less.map(([k, v]) => tr(k, `-${naira(v)}`)).join('')}${tr('Total deductions', naira(l.totalDeductions), true)}
        <tr><td colspan="2" style="border-top:2px solid #0e5c43"></td></tr>${tr('Net pay', naira(l.net), true)}
      </table>
      <p style="margin-top:20px;font-size:12px;color:#5f6a63">Sent by ${escape(school)} with School Precise. Questions about your pay? Ask the school's accountant.</p></div>`;
    return { text, html };
  }

  /** A staff member's own payslips from approved payrolls, newest first. */
  async myPayslips(schoolId: string, user: JwtPayload) {
    const u = (await this.db.collection('users').doc(user.sub).get()).data();
    const keys = new Set([`U_${user.sub}`, ...(u?.teacherId ? [`T_${u.teacherId}`] : [])]);
    const [snap, school] = await Promise.all([
      this.db.collection('payrollRuns').where('schoolId', '==', schoolId).get(),
      this.db.collection('schools').doc(schoolId).get(),
    ]);
    const s = school.data() ?? {};
    const payslips = snap.docs
      .map((d) => d.data())
      .filter((r) => r.status === 'APPROVED')
      .flatMap((r) => (r.lines as PayLine[]).filter((l) => keys.has(l.key) && !l.excluded).map((l) => ({ month: r.month as string, label: monthName(r.month), line: l })))
      .sort((a, b) => b.month.localeCompare(a.month));
    return { school: { name: s.name ?? '', logo: s.logo ?? null, address: s.address ?? '', phone: s.phone ?? '', email: s.email ?? '' }, payslips };
  }

  // ---------- Other staff ----------

  async otherStaff(schoolId: string) {
    const snap = await this.db.collection('otherStaff').where('schoolId', '==', schoolId).get();
    return snap.docs
      .filter((d) => d.data().status !== 'INACTIVE')
      .map((d) => ({ id: d.id, key: `O_${d.id}`, firstName: d.data().firstName, lastName: d.data().lastName, role: d.data().role ?? '', staffNumber: d.data().staffNumber ?? '', phone: d.data().phone ?? '', email: d.data().email ?? '' }))
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }

  async saveOtherStaff(schoolId: string, id: string | null, dto: { firstName: string; lastName: string; role: string; staffNumber?: string; phone?: string; email?: string }) {
    const data = {
      firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), role: dto.role.trim(),
      staffNumber: (dto.staffNumber ?? '').trim(), phone: (dto.phone ?? '').trim(), email: (dto.email ?? '').trim(), updatedAt: new Date(),
    };
    if (!data.firstName || !data.lastName || !data.role) throw new BadRequestException('Enter a first name, last name and job.');
    if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) throw new BadRequestException("That email address doesn't look right.");
    if (!id) {
      const ref = await this.db.collection('otherStaff').add({ schoolId, ...data, status: 'ACTIVE', createdAt: new Date() });
      return { id: ref.id, key: `O_${ref.id}`, ...data };
    }
    const doc = await this.db.collection('otherStaff').doc(id).get();
    if (!doc.exists || doc.data()!.schoolId !== schoolId || doc.data()!.status === 'INACTIVE') throw new NotFoundException('Staff member not found');
    await doc.ref.update(data);
    return { id, key: `O_${id}`, ...data };
  }

  async removeOtherStaff(schoolId: string, id: string) {
    const doc = await this.db.collection('otherStaff').doc(id).get();
    if (!doc.exists || doc.data()!.schoolId !== schoolId) throw new NotFoundException('Staff member not found');
    await doc.ref.update({ status: 'INACTIVE', updatedAt: new Date() });
    return { id, removed: true };
  }

  /** Guards a key in a URL before it is used. */
  assertKey(key: string) {
    if (!isStaffKey(key)) throw new ForbiddenException('Unknown staff member.');
  }
}
