import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { schoolToday } from '../../common/school-date';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { AttendanceService } from '../attendance/attendance.service';

import { StaffClockService } from './staff-clock.service';
import { CODE_ALPHABET, CODE_LENGTH, QR_PREFIX, REPEAT_WINDOW_MS, ScanAction, ScanMode, isTime, newCode, readCode, timeAt, toDate } from './gate-shared';

export { QR_PREFIX, ScanMode };

@Injectable()
export class GateService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly attendance: AttendanceService,
    private readonly staffClock: StaffClockService,
  ) {}

  private get db() {
    return this.firebase.firestore;
  }

  private clockId = (schoolId: string, date: string, studentId: string) => `${schoolId}__${date}__${studentId}`;

  /** The time after which an arrival counts as late (HH:MM), or null if the school doesn't mark lateness. */
  async settings(schoolId: string) {
    const gate = (await this.db.collection('schools').doc(schoolId).get()).data()?.gate;
    return { lateAfter: (gate?.lateAfter as string | null) ?? null, staffLateAfter: (gate?.staffLateAfter as string | null) ?? null };
  }

  /** Students' and staff's "late after" times; a field left out keeps its current value. */
  async saveSettings(schoolId: string, changes: { lateAfter?: string | null; staffLateAfter?: string | null }) {
    for (const v of [changes.lateAfter, changes.staffLateAfter]) {
      if (v !== undefined && v !== null && !isTime(v)) throw new BadRequestException('Use a time like 08:00.');
    }
    const ref = this.db.collection('schools').doc(schoolId);
    const gate = ((await ref.get()).data()?.gate as Record<string, unknown> | undefined) ?? {};
    const next = { ...gate, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) };
    await ref.update({ gate: next });
    return { lateAfter: (next.lateAfter as string | null) ?? null, staffLateAfter: (next.staffLateAfter as string | null) ?? null };
  }

  /** Records a scan at the gate: clock in, clock out, or a friendly "already" for repeats. */
  async scan(schoolId: string, user: JwtPayload, rawCode: string, mode: ScanMode = 'AUTO') {
    const code = readCode(rawCode ?? '');
    if (code.length !== CODE_LENGTH || [...code].some((c) => !CODE_ALPHABET.includes(c))) {
      throw new BadRequestException("That isn't a School Precise ID card.");
    }
    const found = await this.db.collection('students').where('schoolId', '==', schoolId).where('cardCode', '==', code).limit(2).get();
    if (found.empty) {
      const staffKey = await this.staffClock.findByCode(schoolId, code);
      if (staffKey) return this.staffClock.scan(schoolId, user, staffKey, mode, (await this.settings(schoolId)).staffLateAfter);
    }
    if (found.empty) throw new NotFoundException("This card isn't recognised. It may be from another school, or it was replaced by a newer card.");
    const studentDoc = found.docs[0];
    const st = studentDoc.data();
    if (st.status === 'INACTIVE') throw new BadRequestException(`${st.firstName} ${st.lastName} is no longer at the school.`);

    const now = new Date();
    const date = schoolToday(now);
    const time = timeAt(now);
    const className = st.classId ? String((await this.db.collection('classes').doc(st.classId).get()).data()?.name ?? '') : '';
    const student = { id: studentDoc.id, name: `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim(), admissionNumber: st.admissionNumber ?? '', className };
    const by = user.sub;
    const ref = this.db.collection('gateClock').doc(this.clockId(schoolId, date, studentDoc.id));

    const result = await this.db.runTransaction(async (t: any) => {
      const snap = await t.get(ref);
      const c = snap.exists ? snap.data() : null;
      const inAt = toDate(c?.clockInAt);
      const outAt = toDate(c?.clockOutAt);
      const base = { schoolId, date, studentId: student.id, classId: st.classId ?? null, studentName: student.name, className, admissionNumber: student.admissionNumber };

      let action: ScanAction;
      if (mode === 'IN') action = inAt ? 'ALREADY_IN' : 'IN';
      else if (mode === 'OUT') action = outAt ? 'ALREADY_OUT' : 'OUT';
      else if (!inAt && !outAt) action = 'IN';
      else if (outAt) action = 'ALREADY_OUT';
      else action = now.getTime() - inAt!.getTime() < REPEAT_WINDOW_MS ? 'ALREADY_IN' : 'OUT';

      if (action === 'IN') t.set(ref, { ...base, clockInAt: now, clockInBy: by, clockOutAt: outAt ?? null, clockOutBy: c?.clockOutBy ?? null, updatedAt: now });
      if (action === 'OUT') t.set(ref, { ...base, clockInAt: inAt ?? null, clockInBy: c?.clockInBy ?? null, clockOutAt: now, clockOutBy: by, updatedAt: now });
      return { action, inAt: action === 'IN' ? now : inAt, outAt: action === 'OUT' ? now : outAt };
    });

    // A scan shows the student was at school: tick them into today's attendance.
    let marked: string | null = null;
    if ((result.action === 'IN' || result.action === 'OUT') && st.classId) {
      const { lateAfter } = await this.settings(schoolId);
      const late = result.action === 'IN' && !!lateAfter && time > lateAfter;
      marked = await this.markPresent(schoolId, st.classId, student.id, date, late, by, now);
      if (marked) await this.attendance.recountIfTaken(schoolId, st.classId, date);
    }

    return {
      who: 'STUDENT' as const,
      action: result.action,
      // The face lets the gate check the card belongs to the child holding it.
      student: { ...student, photo: (st.photoThumb as string | undefined) ?? null },
      time,
      clockIn: result.inAt ? timeAt(result.inAt) : null,
      clockOut: result.outAt ? timeAt(result.outAt) : null,
      late: marked === 'LATE',
      marked,
    };
  }

  /**
   * Present (or Late) unless a mark already says otherwise. An "absent" mark becomes Late:
   * the student did arrive. Returns the new status, or null if nothing changed.
   */
  private async markPresent(schoolId: string, classId: string, studentId: string, date: string, late: boolean, by: string, now: Date) {
    const ref = this.db.collection('attendance').doc(this.attendance.markId(schoolId, date, studentId));
    return this.db.runTransaction(async (t: any) => {
      const snap = await t.get(ref);
      const current = snap.exists ? snap.data().status : null;
      let next: string | null = null;
      if (!current) next = late ? 'LATE' : 'PRESENT';
      else if (current === 'ABSENT') next = 'LATE';
      if (!next) return null;
      t.set(ref, {
        schoolId, classId, studentId, subjectId: null, date, status: next, source: 'GATE',
        recordedBy: by, createdAt: snap.exists ? snap.data().createdAt : now, updatedAt: now,
      });
      return next;
    });
  }

  /** Today at the gate: student and staff totals, and the latest scans, newest first. */
  async today(schoolId: string) {
    const date = schoolToday();
    const [snap, staffRows] = await Promise.all([
      this.db.collection('gateClock').where('schoolId', '==', schoolId).where('date', '==', date).get(),
      this.staffClock.todayEvents(schoolId, date),
    ]);
    const rows = snap.docs.map((d) => d.data());
    const people = [
      ...rows.map((r) => ({ who: 'STUDENT' as const, id: r.studentId as string, name: r.studentName as string, detail: r.className as string, r })),
      ...staffRows.map((r) => ({ who: 'STAFF' as const, id: r.staffKey as string, name: r.name as string, detail: r.role as string, r })),
    ];
    const events = people
      .flatMap((p) => [
        p.r.clockInAt ? { at: toDate(p.r.clockInAt)!, action: 'IN' as const, p } : null,
        p.r.clockOutAt ? { at: toDate(p.r.clockOutAt)!, action: 'OUT' as const, p } : null,
      ])
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 40)
      .map((e) => ({ who: e.p.who, action: e.action, time: timeAt(e.at), studentId: e.p.id, name: e.p.name, className: e.p.detail }));
    return {
      date,
      clockedIn: rows.filter((r) => r.clockInAt).length,
      clockedOut: rows.filter((r) => r.clockOutAt).length,
      stillIn: rows.filter((r) => r.clockInAt && !r.clockOutAt).length,
      staff: {
        clockedIn: staffRows.filter((r) => r.clockInAt).length,
        stillIn: staffRows.filter((r) => r.clockInAt && !r.clockOutAt).length,
        late: staffRows.filter((r) => r.late).length,
      },
      recent: events,
    };
  }

  /** Card details for a class (or the whole school), giving any student without a card code a new one. */
  async cards(schoolId: string, classId?: string) {
    let q: FirebaseFirestore.Query = this.db.collection('students').where('schoolId', '==', schoolId);
    if (classId) {
      await getOwnedDoc(this.db.collection('classes'), classId, schoolId, 'Class not found');
      q = q.where('classId', '==', classId);
    }
    const [studentsSnap, classesSnap, school] = await Promise.all([
      q.get(),
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
      this.db.collection('schools').doc(schoolId).get(),
    ]);
    const classNames = new Map(classesSnap.docs.map((d) => [d.id, String(d.data().name ?? '')]));
    const active = studentsSnap.docs.filter((d) => d.data().status !== 'INACTIVE');
    const batch = this.db.batch();
    let added = 0;
    const cards = active.map((d) => {
      let code = d.data().cardCode as string | undefined;
      if (!code) {
        code = newCode();
        batch.update(d.ref, { cardCode: code, cardIssuedAt: new Date() });
        added++;
      }
      const s = d.data();
      return {
        studentId: d.id, firstName: s.firstName ?? '', lastName: s.lastName ?? '', admissionNumber: s.admissionNumber ?? '',
        className: s.classId ? classNames.get(s.classId) ?? '' : '', qr: `${QR_PREFIX}${code}`,
        photo: (s.photoThumb as string | undefined) ?? null,
      };
    });
    if (added) await batch.commit();
    cards.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
    const sch = school.data() ?? {};
    return { school: { name: sch.name ?? '', logo: sch.logo ?? null, motto: sch.motto ?? '', phone: sch.phone ?? '' }, cards };
  }

  /** A lost card: a new code for the student, so the old card stops working. */
  async reissue(schoolId: string, studentId: string) {
    const doc = await getOwnedDoc(this.db.collection('students'), studentId, schoolId, 'Student not found');
    const code = newCode();
    await doc.ref.update({ cardCode: code, cardIssuedAt: new Date() });
    return { studentId, qr: `${QR_PREFIX}${code}` };
  }
}
