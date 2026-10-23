import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { schoolToday } from '../../common/school-date';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ScanAction, ScanMode, REPEAT_WINDOW_MS, newCode, timeAt, toDate } from './gate-shared';

const ROLE_LABEL: Record<string, string> = {
  SCHOOL_OWNER: 'School owner',
  SUPER_ADMIN: 'Administrator',
  PRINCIPAL: 'Principal',
  VICE_PRINCIPAL: 'Vice principal',
  ACCOUNTANT: 'Accountant',
  TEACHER: 'Teacher',
};

/**
 * Someone who works at the school: a teacher record (T_<id>), a staff account not linked to one (U_<id>),
 * or other staff with no account, such as security, cleaners and drivers (O_<id>).
 */
export interface StaffMember {
  key: string;
  firstName: string;
  lastName: string;
  role: string;
  number: string;
  email: string;
}

export const isStaffKey = (key: string) => /^[TUO]_[A-Za-z0-9_-]{1,128}$/.test(key);
const COLLECTION = { T: 'teachers', U: 'users', O: 'otherStaff' } as const;

/**
 * Staff clock in and out at the gate with their own ID cards. Card codes live in their own
 * collection (staffCards), so they never travel with the teacher or account records.
 */
@Injectable()
export class StaffClockService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private cardRef = (schoolId: string, key: string) => this.db.collection('staffCards').doc(`${schoolId}__${key}`);
  private clockRef = (schoolId: string, date: string, key: string) => this.db.collection('staffClock').doc(`${schoolId}__${date}__${key}`);

  private fromTeacher(id: string, t: FirebaseFirestore.DocumentData): StaffMember {
    return {
      key: `T_${id}`, firstName: t.firstName ?? '', lastName: t.lastName ?? '',
      role: t.department ? `Teacher · ${t.department}` : 'Teacher', number: t.employeeNumber ?? '', email: t.email ?? '',
    };
  }

  private fromOther(id: string, o: FirebaseFirestore.DocumentData): StaffMember {
    return { key: `O_${id}`, firstName: o.firstName ?? '', lastName: o.lastName ?? '', role: o.role || 'Staff', number: o.staffNumber ?? '', email: o.email ?? '' };
  }

  private fromUser(id: string, u: FirebaseFirestore.DocumentData): StaffMember {
    return { key: `U_${id}`, firstName: u.firstName ?? '', lastName: u.lastName ?? '', role: ROLE_LABEL[u.role] ?? 'Staff', number: '', email: u.email ?? '' };
  }

  /** Everyone who clocks in: active teachers, staff accounts (principal, accountant…) that aren't a teacher's, and other staff. */
  async roster(schoolId: string): Promise<StaffMember[]> {
    const [teachers, users, others] = await Promise.all([
      this.db.collection('teachers').where('schoolId', '==', schoolId).get(),
      this.db.collection('users').where('schoolId', '==', schoolId).get(),
      this.db.collection('otherStaff').where('schoolId', '==', schoolId).get(),
    ]);
    const people = [
      ...others.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => this.fromOther(d.id, d.data())),
      ...teachers.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => this.fromTeacher(d.id, d.data())),
      ...users.docs
        .filter((d) => { const u = d.data(); return u.role !== 'PARENT' && u.status !== 'DISABLED' && !u.teacherId; })
        .map((d) => this.fromUser(d.id, d.data())),
    ];
    return people.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }

  /** One staff member, or null if they have left or their account is switched off. */
  async member(schoolId: string, key: string): Promise<StaffMember | null> {
    if (!isStaffKey(key)) return null;
    const [kind, id] = [key.slice(0, 1) as keyof typeof COLLECTION, key.slice(2)];
    const doc = await this.db.collection(COLLECTION[kind]).doc(id).get();
    const d = doc.data();
    if (!doc.exists || d!.schoolId !== schoolId) return null;
    if (kind === 'T') return d!.status === 'INACTIVE' ? null : this.fromTeacher(id, d!);
    if (kind === 'O') return d!.status === 'INACTIVE' ? null : this.fromOther(id, d!);
    return d!.role === 'PARENT' || d!.status === 'DISABLED' ? null : this.fromUser(id, d!);
  }

  /** Card details for every staff member, giving anyone without a card a new code. */
  async cards(schoolId: string) {
    const [people, cardsSnap, school] = await Promise.all([
      this.roster(schoolId),
      this.db.collection('staffCards').where('schoolId', '==', schoolId).get(),
      this.db.collection('schools').doc(schoolId).get(),
    ]);
    const codes = new Map(cardsSnap.docs.map((d) => [d.data().staffKey as string, d.data().code as string]));
    const batch = this.db.batch();
    let added = 0;
    const cards = people.map((p) => {
      let code = codes.get(p.key);
      if (!code) {
        code = newCode();
        batch.set(this.cardRef(schoolId, p.key), { schoolId, staffKey: p.key, code, issuedAt: new Date() });
        added++;
      }
      return { ...p, qr: `SP1-${code}` };
    });
    if (added) await batch.commit();
    const sch = school.data() ?? {};
    return { school: { name: sch.name ?? '', logo: sch.logo ?? null, motto: sch.motto ?? '', phone: sch.phone ?? '' }, cards };
  }

  /** A lost card: a new code, so the old card stops working. */
  async reissue(schoolId: string, key: string) {
    if (!isStaffKey(key) || !(await this.member(schoolId, key))) throw new NotFoundException('Staff member not found');
    const code = newCode();
    await this.cardRef(schoolId, key).set({ schoolId, staffKey: key, code, issuedAt: new Date() });
    return { key, qr: `SP1-${code}` };
  }

  /** The staff member a card code belongs to, or null if it isn't a staff card of this school. */
  async findByCode(schoolId: string, code: string) {
    const found = await this.db.collection('staffCards').where('schoolId', '==', schoolId).where('code', '==', code).limit(1).get();
    return found.empty ? null : (found.docs[0].data().staffKey as string);
  }

  /** Clock a staff member in or out; mirrors the students' rules, with the school's staff "late after" time. */
  async scan(schoolId: string, user: JwtPayload, key: string, mode: ScanMode, staffLateAfter: string | null) {
    const person = await this.member(schoolId, key);
    if (!person) throw new BadRequestException('This staff card belongs to someone who no longer works at the school.');
    const now = new Date();
    const date = schoolToday(now);
    const time = timeAt(now);
    const name = `${person.firstName} ${person.lastName}`.trim();
    const ref = this.clockRef(schoolId, date, key);

    const result = await this.db.runTransaction(async (t: any) => {
      const snap = await t.get(ref);
      const c = snap.exists ? snap.data() : null;
      const inAt = toDate(c?.clockInAt);
      const outAt = toDate(c?.clockOutAt);
      const base = { schoolId, date, staffKey: key, name, role: person.role, number: person.number };

      let action: ScanAction;
      if (mode === 'IN') action = inAt ? 'ALREADY_IN' : 'IN';
      else if (mode === 'OUT') action = outAt ? 'ALREADY_OUT' : 'OUT';
      else if (!inAt && !outAt) action = 'IN';
      else if (outAt) action = 'ALREADY_OUT';
      else action = now.getTime() - inAt!.getTime() < REPEAT_WINDOW_MS ? 'ALREADY_IN' : 'OUT';

      const late = action === 'IN' ? !!staffLateAfter && time > staffLateAfter : !!c?.late;
      if (action === 'IN') t.set(ref, { ...base, clockInAt: now, clockInBy: user.sub, clockOutAt: outAt ?? null, clockOutBy: c?.clockOutBy ?? null, late, updatedAt: now });
      if (action === 'OUT') t.set(ref, { ...base, clockInAt: inAt ?? null, clockInBy: c?.clockInBy ?? null, clockOutAt: now, clockOutBy: user.sub, late, updatedAt: now });
      return { action, late, inAt: action === 'IN' ? now : inAt, outAt: action === 'OUT' ? now : outAt };
    });

    return {
      who: 'STAFF' as const,
      action: result.action,
      // Shown on the same result card as a student's: the role in place of the class, the staff number in place of the admission number.
      student: { id: key, name, admissionNumber: person.number, className: person.role, photo: null },
      time,
      clockIn: result.inAt ? timeAt(result.inAt) : null,
      clockOut: result.outAt ? timeAt(result.outAt) : null,
      late: result.action === 'IN' && result.late,
      marked: null,
    };
  }

  /** A day's staff attendance: everyone on the roster, with their clock times. */
  async day(schoolId: string, date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Use a date like 2026-10-23.');
    const [people, clockSnap] = await Promise.all([
      this.roster(schoolId),
      this.db.collection('staffClock').where('schoolId', '==', schoolId).where('date', '==', date).get(),
    ]);
    const clocks = new Map(clockSnap.docs.map((d) => [d.data().staffKey as string, d.data()]));
    const rows = people.map((p) => {
      const c = clocks.get(p.key);
      const inAt = toDate(c?.clockInAt);
      const outAt = toDate(c?.clockOutAt);
      return { ...p, clockIn: inAt ? timeAt(inAt) : null, clockOut: outAt ? timeAt(outAt) : null, late: !!c?.late };
    });
    // Someone clocked in that day who has since left still shows, so the record stays complete.
    for (const [key, c] of clocks) {
      if (rows.some((r) => r.key === key)) continue;
      const inAt = toDate(c.clockInAt);
      const outAt = toDate(c.clockOutAt);
      const [firstName, ...rest] = String(c.name ?? '').split(' ');
      rows.push({ key, firstName, lastName: rest.join(' '), role: c.role ?? '', number: c.number ?? '', email: '', clockIn: inAt ? timeAt(inAt) : null, clockOut: outAt ? timeAt(outAt) : null, late: !!c.late });
    }
    const arrived = rows.filter((r) => r.clockIn || r.clockOut);
    return {
      date,
      total: people.length,
      arrived: arrived.length,
      late: rows.filter((r) => r.late).length,
      notIn: people.length - arrived.filter((r) => people.some((p) => p.key === r.key)).length,
      staff: rows,
    };
  }

  /** Today's staff scans, for the gate screen's totals and list. */
  async todayEvents(schoolId: string, date: string) {
    const snap = await this.db.collection('staffClock').where('schoolId', '==', schoolId).where('date', '==', date).get();
    return snap.docs.map((d) => d.data());
  }
}
