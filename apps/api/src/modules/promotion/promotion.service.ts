import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { TermCalendar } from '../../common/term-calendar';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ApplyPromotionDto } from './dto/promotion.dto';

const BATCH = 400;

/** Splits "JSS 1" into ("jss", 1); null when there's no trailing number. */
const parse = (name: string) => {
  const m = /^(.*?)[\s\-_.]*(\d+)\s*([a-z])?$/i.exec(name.trim());
  return m ? { stem: m[1].toLowerCase().replace(/[\s\-_.]+/g, ''), n: Number(m[2]), arm: (m[3] ?? '').toLowerCase() } : null;
};

/**
 * Where a class's students usually go next: the same stem one level up (JSS1 -> JSS2, Primary 5 -> Primary 6),
 * across the usual Nigerian boundaries (Primary/Basic 6 -> JSS1, JSS3 -> SS1), else they graduate.
 */
export function suggestNext(name: string, classes: { id: string; name: string }[]): string {
  const p = parse(name);
  if (!p) return 'STAY';
  const find = (stems: string[], n: number) =>
    classes.find((c) => {
      const q = parse(c.name);
      return q && stems.includes(q.stem) && q.n === n && q.arm === p.arm;
    }) ??
    classes.find((c) => {
      const q = parse(c.name);
      return q && stems.includes(q.stem) && q.n === n;
    });
  const same = find([p.stem], p.n + 1);
  if (same) return same.id;
  const primary = ['primary', 'basic', 'pry', 'grade', 'year'];
  if (primary.includes(p.stem) && p.n >= 5) return find(['jss', 'js', 'jhs'], 1)?.id ?? 'GRADUATE';
  if (['jss', 'js', 'jhs'].includes(p.stem) && p.n === 3) return find(['ss', 'sss', 'shs'], 1)?.id ?? 'GRADUATE';
  return 'GRADUATE';
}

const nextSession = (session: string) => {
  const y = Number(session.slice(0, 4)) + 1;
  return `${y}/${y + 1}`;
};

@Injectable()
export class PromotionService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get log() {
    return this.db.collection('promotions');
  }

  private async commitInChunks(ops: ((b: FirebaseFirestore.WriteBatch) => void)[]) {
    for (let i = 0; i < ops.length; i += BATCH) {
      const batch = this.db.batch();
      ops.slice(i, i + BATCH).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  private async lastPromotion(schoolId: string) {
    const snap = await this.log.where('schoolId', '==', schoolId).get();
    return snap.docs.filter((d) => !d.data().undone).sort((a, b) => (b.data().at?.valueOf?.() ?? 0) - (a.data().at?.valueOf?.() ?? 0))[0] ?? null;
  }

  /** Every class with its current students and a suggested next class. */
  async plan(schoolId: string) {
    const [classSnap, studentSnap, last] = await Promise.all([
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
      this.db.collection('students').where('schoolId', '==', schoolId).get(),
      this.lastPromotion(schoolId),
    ]);
    const classes = classSnap.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => ({ id: d.id, name: String(d.data().name ?? '') }));
    const students = studentSnap.docs.filter((d) => d.data().status !== 'INACTIVE');
    return {
      toSession: nextSession((await TermCalendar.load(this.db as any, schoolId)).current().session),
      classes: classes
        .map((c) => ({
          classId: c.id,
          name: c.name,
          suggested: suggestNext(c.name, classes),
          students: students
            .filter((s) => s.data().classId === c.id)
            .map((s) => ({ id: s.id, firstName: s.data().firstName ?? '', lastName: s.data().lastName ?? '', admissionNumber: s.data().admissionNumber ?? '' }))
            .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      last: last ? { id: last.id, toSession: last.data().toSession, at: last.data().at, byName: last.data().byName, counts: last.data().counts } : null,
    };
  }

  /** Moves every student in one go, based on where each class goes and who is held back. */
  async apply(schoolId: string, user: JwtPayload, dto: ApplyPromotionDto) {
    const [y1, y2] = dto.toSession.split('/').map(Number);
    if (y2 !== y1 + 1) throw new BadRequestException('Session must be two consecutive years, like 2027/2028.');
    const done = (await this.log.where('schoolId', '==', schoolId).where('toSession', '==', dto.toSession).get()).docs.filter((d) => !d.data().undone);
    // Each moved student also carries the session they were promoted into, so a second run is refused
    // even if the promotion record itself were ever missing.
    const marked = await this.db.collection('students').where('schoolId', '==', schoolId).where('promotedInto', '==', dto.toSession).limit(1).get();
    if (done.length || !marked.empty) throw new BadRequestException(`Students have already been promoted into ${dto.toSession}. Undo that first if you need to redo it.`);

    const [classSnap, studentSnap, me] = await Promise.all([
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
      this.db.collection('students').where('schoolId', '==', schoolId).get(),
      this.db.collection('users').doc(user.sub).get(),
    ]);
    const active = new Map(classSnap.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => [d.id, String(d.data().name ?? '')]));
    const moveOf = new Map<string, string>();
    for (const m of dto.moves) {
      if (!active.has(m.fromClassId)) throw new BadRequestException("One of the classes wasn't found. Refresh and try again.");
      if (moveOf.has(m.fromClassId)) throw new BadRequestException(`${active.get(m.fromClassId)} is listed twice.`);
      if (m.to !== 'GRADUATE' && m.to !== 'STAY' && !active.has(m.to)) throw new BadRequestException(`Choose where ${active.get(m.fromClassId)} goes.`);
      moveOf.set(m.fromClassId, m.to);
    }
    const holdBack = new Set(dto.holdBack);
    const students = studentSnap.docs.filter((d) => d.data().status !== 'INACTIVE' && active.has(d.data().classId));
    if (dto.holdBack.some((id) => !students.some((s) => s.id === id))) throw new BadRequestException("A held-back student wasn't found. Refresh and try again.");

    const changes: { studentId: string; fromClassId: string; toClassId: string | null; graduated: boolean }[] = [];
    for (const s of students) {
      const to = moveOf.get(s.data().classId) ?? 'STAY';
      if (holdBack.has(s.id) || to === 'STAY' || to === s.data().classId) continue;
      changes.push({ studentId: s.id, fromClassId: s.data().classId, toClassId: to === 'GRADUATE' ? null : to, graduated: to === 'GRADUATE' });
    }
    if (changes.length === 0) throw new BadRequestException('Nobody would move. Choose where each class goes.');

    const now = new Date();
    const counts = {
      promoted: changes.filter((c) => !c.graduated).length,
      graduated: changes.filter((c) => c.graduated).length,
      stayed: students.length - changes.length,
    };
    const byName = me.exists ? `${me.data()!.firstName ?? ''} ${me.data()!.lastName ?? ''}`.trim() : user.email;
    // Save the record first (as plain data), so Undo and the duplicate check work even if moving fails partway.
    const ref = await this.log.add({
      schoolId, toSession: dto.toSession, at: now, by: user.sub, byName,
      moves: dto.moves.map((m) => ({ fromClassId: m.fromClassId, to: m.to })),
      changes, counts, undone: false, status: 'APPLYING',
    });
    const col = this.db.collection('students');
    await this.commitInChunks(
      changes.map((c) => (b: FirebaseFirestore.WriteBatch) =>
        b.update(col.doc(c.studentId), c.graduated
          ? { status: 'INACTIVE', leftReason: 'GRADUATED', leftSession: dto.toSession, leftAt: now, promotedInto: dto.toSession, updatedAt: now }
          : { classId: c.toClassId, promotedInto: dto.toSession, updatedAt: now }),
      ),
    );
    await ref.update({ status: 'DONE' });
    return { id: ref.id, toSession: dto.toSession, counts };
  }

  /** Puts students back where they were before the most recent promotion. */
  async undo(schoolId: string, user: JwtPayload, id: string) {
    const doc = await getOwnedDoc(this.log, id, schoolId, 'Promotion not found');
    if (doc.data()!.undone) throw new BadRequestException('This promotion has already been undone.');
    const last = await this.lastPromotion(schoolId);
    if (last?.id !== id) throw new BadRequestException('Only the most recent promotion can be undone.');
    const now = new Date();
    const col = this.db.collection('students');
    const changes = doc.data()!.changes as { studentId: string; fromClassId: string; graduated: boolean }[];
    await this.commitInChunks(
      changes.map((c) => (b: FirebaseFirestore.WriteBatch) =>
        b.update(col.doc(c.studentId), c.graduated
          ? { status: 'ACTIVE', classId: c.fromClassId, leftReason: null, leftSession: null, leftAt: null, promotedInto: null, updatedAt: now }
          : { classId: c.fromClassId, promotedInto: null, updatedAt: now }),
      ),
    );
    await doc.ref.update({ undone: true, undoneAt: now, undoneBy: user.sub });
    return { id, restored: changes.length };
  }
}
