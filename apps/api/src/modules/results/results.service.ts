import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { SaveSheetDto } from './dto/save-sheet.dto';

/** A 70–100, B 60–69, C 50–59, D 45–49, E 40–44, F below 40 (totals are out of 100). */
export const gradeFor = (total: number) =>
  total >= 70 ? 'A' : total >= 60 ? 'B' : total >= 50 ? 'C' : total >= 45 ? 'D' : total >= 40 ? 'E' : 'F';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Total and grade once every part is in; CA is skipped when the exam is out of 100. */
export function scoreSummary(ca: number | null, exam: number | null, caMax: number) {
  const complete = exam !== null && (caMax === 0 || ca !== null);
  const total = complete ? round1((ca ?? 0) + exam!) : null;
  return { total, grade: total === null ? null : gradeFor(total) };
}

@Injectable()
export class ResultsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get col() {
    return this.db.collection('examResults');
  }

  /** One result per student per paper, so saving a sheet twice updates rather than duplicates. */
  private resultId = (examId: string, studentId: string) => `${examId}__${studentId}`;

  private async paperContext(schoolId: string, examId: string) {
    const paperDoc = await getOwnedDoc(this.db.collection('exams'), examId, schoolId, 'Exam paper not found');
    const paper = paperDoc.data()!;
    if (!paper.seriesId) throw new BadRequestException('This exam was made with the old form. Create an exam on the Exams page instead.');
    const [series, cls] = await Promise.all([
      this.db.collection('examSeries').doc(paper.seriesId).get(),
      this.db.collection('classes').doc(paper.classId).get(),
    ]);
    const examMax = Number(paper.maxScore ?? 60);
    return {
      paper: { id: paperDoc.id, ...paper } as { id: string; seriesId: string; classId: string; subjectId: string; title: string },
      seriesName: series.exists ? series.data()!.name : '',
      className: cls.exists ? cls.data()!.name : '',
      examMax,
      caMax: Math.max(0, 100 - examMax),
    };
  }

  private async classStudents(schoolId: string, classId: string) {
    const snap = await this.db.collection('students').where('schoolId', '==', schoolId).where('classId', '==', classId).get();
    return snap.docs
      .filter((d) => d.data().status !== 'INACTIVE')
      .map((d) => ({ id: d.id, firstName: d.data().firstName ?? '', lastName: d.data().lastName ?? '', admissionNumber: d.data().admissionNumber ?? '' }))
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }

  /** The score sheet for one paper: every current student in the class with their CA, exam, total and grade. */
  async getSheet(schoolId: string, examId: string) {
    const ctx = await this.paperContext(schoolId, examId);
    const [students, snap] = await Promise.all([
      this.classStudents(schoolId, ctx.paper.classId),
      this.col.where('schoolId', '==', schoolId).where('examId', '==', examId).get(),
    ]);
    const byStudent = new Map(snap.docs.map((d) => [d.data().studentId, d.data()]));
    const latest = snap.docs.map((d) => d.data()).sort((a, b) => (b.updatedAt?.valueOf?.() ?? 0) - (a.updatedAt?.valueOf?.() ?? 0))[0];
    return {
      examId,
      seriesId: ctx.paper.seriesId,
      seriesName: ctx.seriesName,
      classId: ctx.paper.classId,
      className: ctx.className,
      subjectId: ctx.paper.subjectId,
      subject: ctx.paper.title,
      caMax: ctx.caMax,
      examMax: ctx.examMax,
      updatedAt: latest?.updatedAt ?? null,
      updatedByName: latest?.enteredByName ?? null,
      students: students.map((s) => {
        const r = byStudent.get(s.id);
        const ca = r?.ca ?? null;
        const exam = r?.exam ?? null;
        return { ...s, ca, exam, ...scoreSummary(ca, exam, ctx.caMax) };
      }),
    };
  }

  /** Saves scores for a paper. Students with both parts cleared have their result removed. */
  async saveSheet(schoolId: string, user: JwtPayload, dto: SaveSheetDto) {
    const ctx = await this.paperContext(schoolId, dto.examId);
    const students = await this.classStudents(schoolId, ctx.paper.classId);
    const names = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
    const seen = new Set<string>();
    for (const s of dto.scores) {
      const name = names.get(s.studentId);
      if (!name) throw new BadRequestException(`A student on this sheet isn't in ${ctx.className}. Refresh and try again.`);
      if (seen.has(s.studentId)) throw new BadRequestException(`${name} appears twice.`);
      seen.add(s.studentId);
      if (s.ca != null && s.ca > ctx.caMax) {
        throw new BadRequestException(ctx.caMax === 0 ? `This paper is marked out of 100, so there's no CA. Clear ${name}'s CA.` : `${name}'s CA is ${s.ca}, but CA is out of ${ctx.caMax}.`);
      }
      if (s.exam != null && s.exam > ctx.examMax) throw new BadRequestException(`${name}'s exam score is ${s.exam}, but this paper is out of ${ctx.examMax}.`);
    }

    const taker = await this.db.collection('users').doc(user.sub).get();
    const enteredByName = taker.exists ? `${taker.data()!.firstName ?? ''} ${taker.data()!.lastName ?? ''}`.trim() || user.email : user.email;
    const existing = await this.col.where('schoolId', '==', schoolId).where('examId', '==', dto.examId).get();
    const previous = new Map(existing.docs.map((d) => [d.id, d.data()]));
    const now = new Date();
    const batch = this.db.batch();
    let changed = 0;

    for (const s of dto.scores) {
      const id = this.resultId(dto.examId, s.studentId);
      const before = previous.get(id);
      const ca = s.ca !== undefined ? s.ca : before?.ca ?? null;
      const exam = s.exam !== undefined ? s.exam : before?.exam ?? null;
      if (before && (before.ca ?? null) === ca && (before.exam ?? null) === exam) continue;
      if (ca === null && exam === null) {
        if (before) { batch.delete(this.col.doc(id)); changed++; }
        continue;
      }
      const { total, grade } = scoreSummary(ca, exam, ctx.caMax);
      batch.set(this.col.doc(id), {
        schoolId,
        examId: dto.examId,
        seriesId: ctx.paper.seriesId,
        classId: ctx.paper.classId,
        subjectId: ctx.paper.subjectId,
        studentId: s.studentId,
        ca,
        exam,
        score: total,
        grade,
        enteredBy: user.sub,
        enteredByName,
        createdAt: before?.createdAt ?? now,
        updatedAt: now,
      });
      changed++;
    }
    if (changed > 0) await batch.commit();
    return { ...(await this.getSheet(schoolId, dto.examId)), changed };
  }

  /** Progress for every paper in an exam series: how many students are scored, and the class average. */
  async progress(schoolId: string, seriesId: string) {
    await getOwnedDoc(this.db.collection('examSeries'), seriesId, schoolId, 'Exam not found');
    const [paperSnap, resultSnap, studentSnap] = await Promise.all([
      this.db.collection('exams').where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get(),
      this.col.where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get(),
      this.db.collection('students').where('schoolId', '==', schoolId).get(),
    ]);
    const active = studentSnap.docs.filter((d) => d.data().status !== 'INACTIVE');
    const classOf = new Map(active.map((d) => [d.id, d.data().classId as string]));
    const classSize = new Map<string, number>();
    active.forEach((d) => classSize.set(d.data().classId, (classSize.get(d.data().classId) ?? 0) + 1));

    return paperSnap.docs
      .map((d) => {
        const p = d.data();
        // Only count students still in the class, so leavers don't inflate progress.
        const results = resultSnap.docs.map((r) => r.data()).filter((r) => r.examId === d.id && classOf.get(r.studentId) === p.classId);
        const totals = results.map((r) => r.score).filter((t): t is number => typeof t === 'number');
        return {
          examId: d.id,
          classId: p.classId as string,
          subjectId: p.subjectId as string,
          subject: p.title as string,
          students: classSize.get(p.classId) ?? 0,
          complete: totals.length,
          started: results.length,
          average: totals.length ? round1(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
        };
      })
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }

  /** Highest scores entered for a paper, so its max score can't be lowered below them. */
  async highestScores(schoolId: string, examId: string) {
    const snap = await this.col.where('schoolId', '==', schoolId).where('examId', '==', examId).get();
    return snap.docs.reduce(
      (m, d) => ({ ca: Math.max(m.ca, d.data().ca ?? 0), exam: Math.max(m.exam, d.data().exam ?? 0) }),
      { ca: 0, exam: 0 },
    );
  }

  async findAll(schoolId: string, query: Record<string, string>) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);
    if (query.examId) ref = ref.where('examId', '==', query.examId);
    if (query.studentId) ref = ref.where('studentId', '==', query.studentId);
    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async count(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
