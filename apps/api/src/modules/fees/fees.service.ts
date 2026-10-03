import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { isIsoDate, Term, TERMS } from '../../common/school-date';
import { TermCalendar } from '../../common/term-calendar';
import { SaveDiscountDto, SaveScheduleDto } from './dto/fees.dto';

export type FeeStatus = 'PAID' | 'PART' | 'UNPAID' | 'NO_FEES';

const looseKey = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');

/** Validates an explicit term and session. */
export function checkTermSession(term?: string, session?: string): { term: Term; session: string } {
  if (!TERMS.includes(term as Term)) throw new BadRequestException('Choose a term.');
  const [y1, y2] = String(session ?? '').split('/').map(Number);
  if (!/^\d{4}\/\d{4}$/.test(session ?? '') || y2 !== y1 + 1) throw new BadRequestException('Session must be two consecutive years, like 2026/2027.');
  return { term: term as Term, session: session! };
}

@Injectable()
export class FeesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get schedules() {
    return this.db.collection('feeSchedules');
  }

  private get discounts() {
    return this.db.collection('feeDiscounts');
  }

  /** The given term, or the school's current term when none is given. */
  async resolveTerm(schoolId: string, term?: string, session?: string) {
    if (!term && !session) return (await TermCalendar.load(this.db as any, schoolId)).current();
    return checkTermSession(term, session);
  }

  /** One fee list per class per term, so saving again replaces it. */
  scheduleId = (term: string, session: string, classId: string) => `${session.replace('/', '-')}__${term}__${classId}`;
  private discountId = (term: string, session: string, studentId: string) => `${session.replace('/', '-')}__${term}__${studentId}`;

  async saveSchedule(schoolId: string, userId: string, dto: SaveScheduleDto) {
    checkTermSession(dto.term, dto.session);
    if (dto.dueDate && !isIsoDate(dto.dueDate)) throw new BadRequestException('Use a due date like 2026-10-15.');
    const items = dto.items.map((i) => ({ name: i.name.trim().replace(/\s+/g, ' '), amount: i.amount }));
    if (items.some((i) => !i.name)) throw new BadRequestException('Give every fee item a name.');
    const seen = new Set<string>();
    for (const i of items) {
      if (seen.has(looseKey(i.name))) throw new BadRequestException(`"${i.name}" is listed twice.`);
      seen.add(looseKey(i.name));
    }
    const total = items.reduce((a, i) => a + i.amount, 0);
    if (total <= 0) throw new BadRequestException('The fees add up to ₦0. Enter at least one amount.');

    const classIds = [...new Set(dto.classIds)];
    const classSnap = await this.db.collection('classes').where('schoolId', '==', schoolId).get();
    const active = new Set(classSnap.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => d.id));
    if (classIds.some((c) => !active.has(c))) throw new BadRequestException("One of the chosen classes wasn't found. Refresh and try again.");

    const now = new Date();
    const batch = this.db.batch();
    for (const classId of classIds) {
      const ref = this.schedules.doc(this.scheduleId(dto.term, dto.session, classId));
      const existing = await ref.get();
      batch.set(ref, {
        schoolId, term: dto.term, session: dto.session, classId, items, total,
        dueDate: dto.dueDate || null,
        createdAt: existing.exists ? existing.data()!.createdAt : now,
        updatedAt: now, updatedBy: userId,
      });
    }
    await batch.commit();
    return { saved: classIds.length, total };
  }

  async deleteSchedule(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.schedules, id, schoolId, 'Fee list not found');
    const s = doc.data()!;
    const paid = await this.db.collection('feePayments').where('schoolId', '==', schoolId).where('term', '==', s.term).where('session', '==', s.session).where('classId', '==', s.classId).get();
    if (paid.docs.some((p) => !p.data().voided)) throw new BadRequestException("Payments have been recorded against these fees, so they can't be removed. Change the amounts instead.");
    await doc.ref.delete();
    return { message: 'Fees removed' };
  }

  async saveDiscount(schoolId: string, userId: string, dto: SaveDiscountDto) {
    checkTermSession(dto.term, dto.session);
    const student = await getOwnedDoc(this.db.collection('students'), dto.studentId, schoolId, 'Student not found');
    const ref = this.discounts.doc(this.discountId(dto.term, dto.session, dto.studentId));
    if (dto.amount === 0) {
      await ref.delete();
      return { amount: 0, reason: null };
    }
    const schedule = await this.schedules.doc(this.scheduleId(dto.term, dto.session, student.data()!.classId)).get();
    if (!schedule.exists || schedule.data()!.schoolId !== schoolId) throw new BadRequestException("Set this class's fees for the term before adding a discount.");
    const paid = await this.paidBy(schoolId, dto.term, dto.session, dto.studentId);
    if (dto.amount > schedule.data()!.total - paid) {
      throw new BadRequestException(`The discount can be at most ₦${(schedule.data()!.total - paid).toLocaleString('en-NG')}, what's left after payments.`);
    }
    const reason = dto.reason?.trim() || null;
    await ref.set({ schoolId, term: dto.term, session: dto.session, studentId: dto.studentId, amount: dto.amount, reason, updatedBy: userId, updatedAt: new Date() });
    return { amount: dto.amount, reason };
  }

  private async paidBy(schoolId: string, term: string, session: string, studentId: string) {
    const snap = await this.db.collection('feePayments').where('schoolId', '==', schoolId).where('studentId', '==', studentId).get();
    return snap.docs.filter((d) => !d.data().voided && d.data().term === term && d.data().session === session).reduce((a, d) => a + d.data().amount, 0);
  }

  /** What one student owes for a term: fee items, discount, payments and balance. */
  async statement(schoolId: string, studentId: string, term?: string, session?: string) {
    const ts = await this.resolveTerm(schoolId, term, session);
    const student = await getOwnedDoc(this.db.collection('students'), studentId, schoolId, 'Student not found');
    const s = student.data()!;
    const [cls, schedule, discount, paySnap, school] = await Promise.all([
      s.classId ? this.db.collection('classes').doc(s.classId).get() : Promise.resolve(null),
      s.classId ? this.schedules.doc(this.scheduleId(ts.term, ts.session, s.classId)).get() : Promise.resolve(null),
      this.discounts.doc(this.discountId(ts.term, ts.session, studentId)).get(),
      this.db.collection('feePayments').where('schoolId', '==', schoolId).where('studentId', '==', studentId).get(),
      this.db.collection('schools').doc(schoolId).get(),
    ]);
    const sched = schedule?.exists && schedule.data()!.schoolId === schoolId ? schedule.data()! : null;
    const disc = discount.exists && discount.data()!.schoolId === schoolId ? discount.data()! : null;
    const payments = paySnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((p) => p.term === ts.term && p.session === ts.session)
      .sort((a, b) => String(a.paidOn).localeCompare(String(b.paidOn)) || String(a.receiptNumber).localeCompare(String(b.receiptNumber)))
      .map((p) => ({ id: p.id, receiptNumber: p.receiptNumber, amount: p.amount, method: p.method, reference: p.reference, paidOn: p.paidOn, voided: !!p.voided, voidReason: p.voidReason ?? null }));
    const paid = payments.filter((p) => !p.voided).reduce((a, p) => a + p.amount, 0);
    const due = sched ? sched.total - (disc?.amount ?? 0) : 0;
    const sch = school.exists ? school.data()! : {};
    return {
      ...ts,
      school: { name: sch.name ?? '', address: [sch.address, sch.city, sch.state].filter(Boolean).join(', '), phone: sch.phone ?? '', email: sch.email ?? '', logo: sch.logo ?? null, motto: sch.motto ?? '' },
      student: { id: studentId, firstName: s.firstName ?? '', lastName: s.lastName ?? '', admissionNumber: s.admissionNumber ?? '', classId: s.classId ?? null, className: cls?.exists ? cls.data()!.name : null },
      items: sched?.items ?? [],
      feesSet: !!sched,
      dueDate: sched?.dueDate ?? null,
      fees: sched?.total ?? 0,
      discount: disc ? { amount: disc.amount, reason: disc.reason } : null,
      due,
      paid,
      balance: due - paid,
      payments,
    };
  }

  /** The term at a glance: expected, collected and outstanding, by class and by student. */
  async overview(schoolId: string, term?: string, session?: string) {
    const ts = await this.resolveTerm(schoolId, term, session);
    const [classSnap, studentSnap, scheduleSnap, discountSnap, paySnap] = await Promise.all([
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
      this.db.collection('students').where('schoolId', '==', schoolId).get(),
      this.schedules.where('schoolId', '==', schoolId).where('term', '==', ts.term).where('session', '==', ts.session).get(),
      this.discounts.where('schoolId', '==', schoolId).where('term', '==', ts.term).where('session', '==', ts.session).get(),
      this.db.collection('feePayments').where('schoolId', '==', schoolId).where('term', '==', ts.term).where('session', '==', ts.session).get(),
    ]);
    const scheduleOf = new Map(scheduleSnap.docs.map((d) => [d.data().classId, { id: d.id, ...(d.data() as any) }]));
    const discountOf = new Map(discountSnap.docs.map((d) => [d.data().studentId, d.data().amount as number]));
    const paidOf = new Map<string, number>();
    for (const p of paySnap.docs) if (!p.data().voided) paidOf.set(p.data().studentId, (paidOf.get(p.data().studentId) ?? 0) + p.data().amount);

    const classes = classSnap.docs.filter((d) => d.data().status !== 'INACTIVE');
    const classIds = new Set(classes.map((d) => d.id));
    const students = studentSnap.docs
      .filter((d) => d.data().status !== 'INACTIVE')
      .map((d) => {
        const s = d.data();
        const sched = s.classId && classIds.has(s.classId) ? scheduleOf.get(s.classId) : undefined;
        const discount = discountOf.get(d.id) ?? 0;
        const due = sched ? sched.total - discount : 0;
        const paid = paidOf.get(d.id) ?? 0;
        const status: FeeStatus = !sched ? 'NO_FEES' : paid >= due ? 'PAID' : paid > 0 ? 'PART' : 'UNPAID';
        return { id: d.id, firstName: s.firstName ?? '', lastName: s.lastName ?? '', admissionNumber: s.admissionNumber ?? '', classId: s.classId ?? null, fees: sched?.total ?? 0, discount, due, paid, balance: due - paid, status };
      })
      .sort((a, b) => b.balance - a.balance || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));

    const byClass = classes
      .map((c) => {
        const list = students.filter((s) => s.classId === c.id);
        const sched = scheduleOf.get(c.id);
        const expected = list.reduce((a, s) => a + s.due, 0);
        const collected = list.reduce((a, s) => a + s.paid, 0);
        return {
          classId: c.id,
          name: String(c.data().name ?? ''),
          scheduleId: sched?.id ?? null,
          items: sched?.items ?? [],
          perStudent: sched?.total ?? null,
          dueDate: sched?.dueDate ?? null,
          students: list.length,
          expected,
          collected,
          outstanding: expected - collected,
          paidInFull: sched ? list.filter((s) => s.status === 'PAID').length : 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const expected = byClass.reduce((a, c) => a + c.expected, 0);
    const collected = byClass.reduce((a, c) => a + c.collected, 0);
    return {
      ...ts,
      totals: {
        expected,
        collected,
        outstanding: expected - collected,
        discounts: students.reduce((a, s) => a + (s.status === 'NO_FEES' ? 0 : s.discount), 0),
        rate: expected ? Math.round((collected / expected) * 100) : null,
        owing: students.filter((s) => s.balance > 0).length,
        paidInFull: students.filter((s) => s.status === 'PAID').length,
      },
      classes: byClass,
      students,
    };
  }

  /** Collected vs expected for the current term, for the dashboard. */
  async termSummary(schoolId: string) {
    const o = await this.overview(schoolId);
    return { term: o.term, session: o.session, expected: o.totals.expected, collected: o.totals.collected, outstanding: o.totals.outstanding, rate: o.totals.rate, owing: o.totals.owing, feesSet: o.classes.some((c) => c.scheduleId) };
  }
}
