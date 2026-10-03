import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { isIsoDate, schoolToday } from '../../common/school-date';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { TeachingScope } from '../../common/teaching-scope';
import { AttendanceStatus, SaveRegisterDto } from './dto/save-register.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

type Counts = Record<AttendanceStatus, number>;

const emptyCounts = (): Counts => ({ PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });

/** Share of students who came in (present or late), leaving excused absences out. Null if nobody counts. */
export const attendanceRate = (c: Counts): number | null => {
  const expected = c.PRESENT + c.ABSENT + c.LATE;
  return expected === 0 ? null : Math.round(((c.PRESENT + c.LATE) / expected) * 100);
};

@Injectable()
export class AttendanceService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  /** One document per student per day, so saving a register twice updates rather than duplicates. */
  private get marks() {
    return this.db.collection('attendance');
  }

  /** One summary per class per day: who took the register, when, and the counts. */
  private get registers() {
    return this.db.collection('attendanceRegisters');
  }

  private markId = (schoolId: string, date: string, studentId: string) => `${schoolId}__${date}__${studentId}`;
  private registerId = (schoolId: string, classId: string, date: string) => `${schoolId}__${classId}__${date}`;

  private checkDate(date: string) {
    if (!isIsoDate(date)) throw new BadRequestException('Use a date like 2026-10-02.');
    if (date > schoolToday()) throw new BadRequestException("You can't take a register for a future date.");
  }

  private async classStudents(schoolId: string, classId: string) {
    const snap = await this.db.collection('students').where('schoolId', '==', schoolId).where('classId', '==', classId).get();
    return snap.docs
      .filter((d) => d.data().status !== 'INACTIVE')
      .map((d) => {
        const s = d.data();
        return { id: d.id, firstName: s.firstName ?? '', lastName: s.lastName ?? '', admissionNumber: s.admissionNumber ?? '' };
      })
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }

  /** The register for a class on a date: every current student with their mark (null if not marked). */
  async getRegister(schoolId: string, classId: string, date: string, user?: JwtPayload) {
    this.checkDate(date);
    const cls = await getOwnedDoc(this.db.collection('classes'), classId, schoolId, 'Class not found');
    if (user) (await TeachingScope.load(this.db as any, user)).requireClass(classId, cls.data()!.name);
    const [students, marksSnap, summary] = await Promise.all([
      this.classStudents(schoolId, classId),
      this.marks.where('schoolId', '==', schoolId).where('classId', '==', classId).where('date', '==', date).get(),
      this.registers.doc(this.registerId(schoolId, classId, date)).get(),
    ]);
    const statusOf = new Map(marksSnap.docs.map((d) => [d.data().studentId, d.data().status as AttendanceStatus]));
    const s = summary.exists ? summary.data()! : null;
    return {
      classId,
      className: cls.data()!.name,
      date,
      takenAt: s?.takenAt ?? null,
      takenByName: s?.takenByName ?? null,
      students: students.map((st) => ({ ...st, status: statusOf.get(st.id) ?? null })),
    };
  }

  /** Saves marks for a class on a date (create or update), and records who took the register. */
  async saveRegister(schoolId: string, user: JwtPayload, dto: SaveRegisterDto) {
    this.checkDate(dto.date);
    const cls = await getOwnedDoc(this.db.collection('classes'), dto.classId, schoolId, 'Class not found');
    if (cls.data()!.status === 'INACTIVE') throw new BadRequestException('That class has been deleted.');
    (await TeachingScope.load(this.db as any, user)).requireClass(dto.classId, cls.data()!.name);
    if (dto.marks.length === 0) throw new BadRequestException('Mark at least one student.');

    const students = await this.classStudents(schoolId, dto.classId);
    const inClass = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
    const seen = new Set<string>();
    for (const m of dto.marks) {
      if (!inClass.has(m.studentId)) throw new BadRequestException(`A student in this register isn't in ${cls.data()!.name}. Refresh and try again.`);
      if (seen.has(m.studentId)) throw new BadRequestException(`${inClass.get(m.studentId)} is marked twice.`);
      seen.add(m.studentId);
    }

    const taker = await this.db.collection('users').doc(user.sub).get();
    const takenByName = taker.exists ? `${taker.data()!.firstName ?? ''} ${taker.data()!.lastName ?? ''}`.trim() || user.email : user.email;
    const now = new Date();

    const existing = await this.marks.where('schoolId', '==', schoolId).where('classId', '==', dto.classId).where('date', '==', dto.date).get();
    const created = new Map(existing.docs.map((d) => [d.id, d.data().createdAt]));

    const batch = this.db.batch();
    for (const m of dto.marks) {
      const id = this.markId(schoolId, dto.date, m.studentId);
      batch.set(this.marks.doc(id), {
        schoolId,
        classId: dto.classId,
        studentId: m.studentId,
        subjectId: null,
        date: dto.date,
        status: m.status,
        recordedBy: user.sub,
        createdAt: created.get(id) ?? now,
        updatedAt: now,
      });
    }
    await batch.commit();

    // Counts come from every mark now stored for this class and day.
    const after = await this.marks.where('schoolId', '==', schoolId).where('classId', '==', dto.classId).where('date', '==', dto.date).get();
    const counts = emptyCounts();
    for (const d of after.docs) if (inClass.has(d.data().studentId)) counts[d.data().status as AttendanceStatus]++;
    await this.registers.doc(this.registerId(schoolId, dto.classId, dto.date)).set({
      schoolId,
      classId: dto.classId,
      date: dto.date,
      takenBy: user.sub,
      takenByName,
      takenAt: now,
      counts,
    });

    return this.getRegister(schoolId, dto.classId, dto.date, user);
  }

  /** Which classes have taken the register on a date (today by default), with counts and rates. */
  async today(schoolId: string, date = schoolToday(), user?: JwtPayload) {
    if (!isIsoDate(date)) throw new BadRequestException('Use a date like 2026-10-02.');
    const scope = user ? await TeachingScope.load(this.db as any, user) : null;
    const [classSnap, registerSnap] = await Promise.all([
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
      this.registers.where('schoolId', '==', schoolId).where('date', '==', date).get(),
    ]);
    const byClass = new Map(registerSnap.docs.map((d) => [d.data().classId, d.data()]));
    const school = emptyCounts();
    const classes = classSnap.docs
      .filter((d) => d.data().status !== 'INACTIVE' && (!scope || scope.canViewClass(d.id)))
      .map((d) => {
        const r = byClass.get(d.id);
        const counts: Counts = r ? { ...emptyCounts(), ...r.counts } : emptyCounts();
        if (r) (Object.keys(counts) as AttendanceStatus[]).forEach((k) => (school[k] += counts[k]));
        return {
          id: d.id,
          name: String(d.data().name ?? ''),
          taken: !!r,
          takenAt: r?.takenAt ?? null,
          takenByName: r?.takenByName ?? null,
          counts,
          rate: r ? attendanceRate(counts) : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return {
      date,
      classesTaken: classes.filter((c) => c.taken).length,
      classesTotal: classes.length,
      counts: school,
      rate: attendanceRate(school),
      classes,
    };
  }

  /** Whether this school has ever taken a register (for the setup checklist). */
  async everTaken(schoolId: string) {
    const snap = await this.registers.where('schoolId', '==', schoolId).limit(1).get();
    return !snap.empty;
  }

  async findAll(schoolId: string, query: Record<string, string>, user?: JwtPayload) {
    const scope = user ? await TeachingScope.load(this.db as any, user) : null;
    let ref: FirebaseFirestore.Query = this.marks.where('schoolId', '==', schoolId);
    if (query.studentId) ref = ref.where('studentId', '==', query.studentId);
    if (query.classId) ref = ref.where('classId', '==', query.classId);
    if (query.date) ref = ref.where('date', '==', query.date);
    if (query.status) ref = ref.where('status', '==', query.status);
    const snapshot = await ref.get();
    return snapshot.docs.filter((d) => !scope || scope.canViewClass(d.data().classId)).map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  /** Corrects one student's mark and keeps that day's register counts in step. */
  async update(schoolId: string, id: string, dto: UpdateAttendanceDto, user?: JwtPayload) {
    const doc = await getOwnedDoc(this.marks, id, schoolId, 'Attendance record not found');
    const previous = doc.data()!;
    if (user) (await TeachingScope.load(this.db as any, user)).requireClass(previous.classId);
    await doc.ref.update({ status: dto.status, updatedAt: new Date() });
    const summaryRef = this.registers.doc(this.registerId(schoolId, previous.classId, previous.date));
    const summary = await summaryRef.get();
    if (summary.exists && previous.status !== dto.status) {
      const counts: Counts = { ...emptyCounts(), ...summary.data()!.counts };
      counts[previous.status as AttendanceStatus] = Math.max(0, (counts[previous.status as AttendanceStatus] ?? 0) - 1);
      counts[dto.status]++;
      await summaryRef.update({ counts });
    }
    return { id, ...previous, status: dto.status };
  }
}
