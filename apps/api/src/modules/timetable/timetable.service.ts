import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { TeachingScope } from '../../common/teaching-scope';
import { DAYS, Day, PeriodDto, SetSlotDto, TimetableSetupDto } from './dto/timetable.dto';

export interface Period { id: string; label: string; start: string; end: string; kind: 'LESSON' | 'BREAK' }
export interface Setup { days: Day[]; periods: Period[] }

/** A common Nigerian school day: eight 40-minute lessons with a short break and lunch. */
export const DEFAULT_SETUP: Setup = {
  days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periods: [
    { id: 'p1', label: 'Period 1', start: '08:00', end: '08:40', kind: 'LESSON' },
    { id: 'p2', label: 'Period 2', start: '08:40', end: '09:20', kind: 'LESSON' },
    { id: 'p3', label: 'Period 3', start: '09:20', end: '10:00', kind: 'LESSON' },
    { id: 'b1', label: 'Short break', start: '10:00', end: '10:20', kind: 'BREAK' },
    { id: 'p4', label: 'Period 4', start: '10:20', end: '11:00', kind: 'LESSON' },
    { id: 'p5', label: 'Period 5', start: '11:00', end: '11:40', kind: 'LESSON' },
    { id: 'p6', label: 'Period 6', start: '11:40', end: '12:20', kind: 'LESSON' },
    { id: 'b2', label: 'Lunch', start: '12:20', end: '13:00', kind: 'BREAK' },
    { id: 'p7', label: 'Period 7', start: '13:00', end: '13:40', kind: 'LESSON' },
    { id: 'p8', label: 'Period 8', start: '13:40', end: '14:20', kind: 'LESSON' },
  ],
};

interface Slot { classId: string; day: Day; periodId: string; subjectId: string }

@Injectable()
export class TimetableService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get slots() {
    return this.db.collection('timetableSlots');
  }

  private slotId = (classId: string, day: string, periodId: string) => `${classId}__${day}__${periodId}`;

  async setup(schoolId: string): Promise<Setup> {
    const doc = await this.db.collection('schools').doc(schoolId).get();
    return (doc.exists && doc.data()!.timetable) || DEFAULT_SETUP;
  }

  /** Saves the school day. Periods must run in order without overlapping; removing a period that has lessons is refused. */
  async saveSetup(schoolId: string, dto: TimetableSetupDto) {
    const periods: Period[] = dto.periods.map((p: PeriodDto) => ({ ...p, id: p.id.trim(), label: p.label.trim() }));
    const ids = new Set<string>();
    for (const [i, p] of periods.entries()) {
      if (ids.has(p.id)) throw new BadRequestException('Two periods have the same id.');
      ids.add(p.id);
      if (p.end <= p.start) throw new BadRequestException(`${p.label} must end after it starts.`);
      if (i > 0 && p.start < periods[i - 1].end) throw new BadRequestException(`${p.label} starts before ${periods[i - 1].label} ends.`);
    }
    const days = DAYS.filter((d) => dto.days.includes(d));
    const used = (await this.slots.where('schoolId', '==', schoolId).get()).docs.map((d) => d.data() as Slot);
    const orphaned = used.filter((s) => !days.includes(s.day) || !periods.some((p) => p.id === s.periodId && p.kind === 'LESSON'));
    if (orphaned.length) throw new BadRequestException(`${orphaned.length} ${orphaned.length === 1 ? 'lesson is' : 'lessons are'} placed in a day or period you removed. Clear ${orphaned.length === 1 ? 'it' : 'them'} first.`);
    await this.db.collection('schools').doc(schoolId).update({ timetable: { days, periods }, updatedAt: new Date() });
    return { days, periods };
  }

  /** Everything needed to show timetables: the setup, all lessons with their teacher, and clashes. */
  private async load(schoolId: string) {
    const [setup, slotSnap, assignSnap, subjectSnap, teacherSnap, classSnap] = await Promise.all([
      this.setup(schoolId),
      this.slots.where('schoolId', '==', schoolId).get(),
      this.db.collection('teachingAssignments').where('schoolId', '==', schoolId).get(),
      this.db.collection('subjects').where('schoolId', '==', schoolId).get(),
      this.db.collection('teachers').where('schoolId', '==', schoolId).get(),
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
    ]);
    const teacherOf = new Map(assignSnap.docs.map((d) => [`${d.data().classId}|${d.data().subjectId}`, (d.data().teacherId as string | null) ?? null]));
    const subjects = new Map(subjectSnap.docs.map((d) => [d.id, String(d.data().name ?? '')]));
    const teachers = new Map(teacherSnap.docs.map((d) => [d.id, `${d.data().firstName ?? ''} ${d.data().lastName ?? ''}`.trim()]));
    const classes = new Map(classSnap.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => [d.id, String(d.data().name ?? '')]));
    const lessons = slotSnap.docs
      .map((d) => d.data() as Slot)
      .filter((s) => classes.has(s.classId))
      .map((s) => {
        const teacherId = teacherOf.get(`${s.classId}|${s.subjectId}`) ?? null;
        return { ...s, subject: subjects.get(s.subjectId) ?? 'Subject', className: classes.get(s.classId)!, teacherId, teacherName: teacherId ? teachers.get(teacherId) ?? null : null };
      });
    // A teacher can't be in two classes in the same period.
    const byTeacherSlot = new Map<string, typeof lessons>();
    for (const l of lessons) if (l.teacherId) byTeacherSlot.set(`${l.teacherId}|${l.day}|${l.periodId}`, [...(byTeacherSlot.get(`${l.teacherId}|${l.day}|${l.periodId}`) ?? []), l]);
    const clashes = [...byTeacherSlot.values()].filter((g) => g.length > 1).map((g) => ({
      teacherId: g[0].teacherId!, teacherName: g[0].teacherName, day: g[0].day, periodId: g[0].periodId,
      lessons: g.map((l) => ({ classId: l.classId, className: l.className, subject: l.subject })),
    }));
    const clashKeys = new Set(clashes.flatMap((c) => c.lessons.map((l) => `${l.classId}|${c.day}|${c.periodId}`)));
    return { setup, lessons: lessons.map((l) => ({ ...l, clash: clashKeys.has(`${l.classId}|${l.day}|${l.periodId}`) })), clashes, teacherOf, subjects, classes, teachers };
  }

  async forClass(schoolId: string, classId: string) {
    const cls = await getOwnedDoc(this.db.collection('classes'), classId, schoolId, 'Class not found');
    const all = await this.load(schoolId);
    const lessons = all.lessons.filter((l) => l.classId === classId);
    // The subjects this class takes, with how many periods a week each has so far.
    const offered = [...all.teacherOf.entries()]
      .filter(([k]) => k.startsWith(`${classId}|`) && all.subjects.has(k.split('|')[1]))
      .map(([k, teacherId]) => {
        const subjectId = k.split('|')[1];
        return { subjectId, subject: all.subjects.get(subjectId)!, teacherId, teacherName: teacherId ? all.teachers.get(teacherId) ?? null : null, periods: lessons.filter((l) => l.subjectId === subjectId).length };
      })
      .sort((a, b) => a.subject.localeCompare(b.subject));
    const lessonSlots = all.setup.days.length * all.setup.periods.filter((p) => p.kind === 'LESSON').length;
    return {
      setup: all.setup,
      class: { id: classId, name: cls.data()!.name },
      lessons,
      subjects: offered,
      filled: lessons.length,
      total: lessonSlots,
      clashes: all.clashes.filter((c) => c.lessons.some((l) => l.classId === classId)),
    };
  }

  async forTeacher(schoolId: string, teacherId: string) {
    const t = await getOwnedDoc(this.db.collection('teachers'), teacherId, schoolId, 'Teacher not found');
    const all = await this.load(schoolId);
    const lessons = all.lessons.filter((l) => l.teacherId === teacherId);
    return {
      setup: all.setup,
      teacher: { id: teacherId, name: `${t.data()!.firstName ?? ''} ${t.data()!.lastName ?? ''}`.trim() },
      lessons,
      periodsPerWeek: lessons.length,
      clashes: all.clashes.filter((c) => c.teacherId === teacherId),
    };
  }

  /** A signed-in teacher's own week. */
  async mine(user: JwtPayload) {
    const scope = await TeachingScope.load(this.db as any, user);
    if (!scope.teacherId) throw new NotFoundException("Your account isn't linked to a teacher record, so there's no timetable to show.");
    return this.forTeacher(user.schoolId, scope.teacherId);
  }

  /** Progress for every class and every clash in the school. */
  async overview(schoolId: string) {
    const all = await this.load(schoolId);
    const lessonSlots = all.setup.days.length * all.setup.periods.filter((p) => p.kind === 'LESSON').length;
    return {
      setup: all.setup,
      classes: [...all.classes.entries()]
        .map(([id, name]) => ({ classId: id, name, filled: all.lessons.filter((l) => l.classId === id).length, total: lessonSlots }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      clashes: all.clashes,
    };
  }

  /** Puts a subject in a class's period (or clears it). Returns any clash it causes so the page can warn. */
  async setSlot(schoolId: string, classId: string, dto: SetSlotDto) {
    const cls = await getOwnedDoc(this.db.collection('classes'), classId, schoolId, 'Class not found');
    if (cls.data()!.status === 'INACTIVE') throw new BadRequestException('That class has been deleted.');
    const setup = await this.setup(schoolId);
    const period = setup.periods.find((p) => p.id === dto.periodId);
    if (!setup.days.includes(dto.day) || !period) throw new BadRequestException("That day or period isn't in your school day.");
    if (period.kind !== 'LESSON') throw new BadRequestException(`${period.label} is a break.`);
    const ref = this.slots.doc(this.slotId(classId, dto.day, dto.periodId));
    if (!dto.subjectId) {
      await ref.delete();
      return { cleared: true, clash: null };
    }
    const assignment = await this.db.collection('teachingAssignments').where('schoolId', '==', schoolId).where('classId', '==', classId).where('subjectId', '==', dto.subjectId).limit(1).get();
    if (assignment.empty) throw new BadRequestException(`${cls.data()!.name} doesn't take that subject. Add it in Class subjects first.`);
    await ref.set({ schoolId, classId, day: dto.day, periodId: dto.periodId, subjectId: dto.subjectId, updatedAt: new Date() });
    const { clashes } = await this.load(schoolId);
    const clash = clashes.find((c) => c.day === dto.day && c.periodId === dto.periodId && c.lessons.some((l) => l.classId === classId)) ?? null;
    return { cleared: false, clash };
  }
}
