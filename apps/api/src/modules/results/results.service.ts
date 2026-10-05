import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { TeachingScope } from '../../common/teaching-scope';
import { SaveSheetDto } from './dto/save-sheet.dto';
import { countOf } from '../../common/aggregate';

/** A 70–100, B 60–69, C 50–59, D 45–49, E 40–44, F below 40 (totals are out of 100). */
export const gradeFor = (total: number) =>
  total >= 70 ? 'A' : total >= 60 ? 'B' : total >= 50 ? 'C' : total >= 45 ? 'D' : total >= 40 ? 'E' : 'F';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A paper's scoring summary, kept on the paper so progress pages needn't read every result. */
export interface ScoreStats { complete: number; started: number; sum: number }
const statsOf = (students: { ca: number | null; exam: number | null; total: number | null }[]): ScoreStats => ({
  complete: students.filter((x) => x.total !== null).length,
  started: students.filter((x) => x.ca !== null || x.exam !== null).length,
  sum: round1(students.reduce((a, x) => a + (x.total ?? 0), 0)),
});

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
  async getSheet(schoolId: string, examId: string, user?: JwtPayload) {
    const ctx = await this.paperContext(schoolId, examId);
    const scope = user ? await TeachingScope.load(this.db as any, user) : null;
    scope?.requireClass(ctx.paper.classId, ctx.className);
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
      canEdit: scope ? scope.canScore(ctx.paper.classId, ctx.paper.subjectId) : true,
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
    (await TeachingScope.load(this.db as any, user)).requireScore(ctx.paper.classId, ctx.paper.subjectId, `${ctx.paper.title} in ${ctx.className}`);
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
    const sheet = await this.getSheet(schoolId, dto.examId, user);
    if (changed > 0) await this.db.collection('exams').doc(dto.examId).update({ scoreStats: statsOf(sheet.students) });
    return { ...sheet, changed };
  }

  /** Progress for every paper in an exam series: how many students are scored, and the class average. */
  async progress(schoolId: string, seriesId: string, user?: JwtPayload) {
    await getOwnedDoc(this.db.collection('examSeries'), seriesId, schoolId, 'Exam not found');
    const scope = user ? await TeachingScope.load(this.db as any, user) : null;
    const paperSnap = await this.db.collection('exams').where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get();
    const papers = paperSnap.docs.filter((d) => !scope || scope.canViewClass(d.data().classId));
    // Class sizes are counted on the database side; each paper carries its own scoring summary.
    const classIds = [...new Set(papers.map((d) => d.data().classId as string))];
    const activeStudents = this.db.collection('students').where('schoolId', '==', schoolId).where('status', '==', 'ACTIVE');
    const sizes = new Map(await Promise.all(classIds.map(async (c) => [c, await countOf(activeStudents.where('classId', '==', c))] as const)));
    const missing = papers.filter((d) => !d.data().scoreStats);
    const filled = missing.length ? await this.backfillStats(schoolId, seriesId, missing) : new Map<string, ScoreStats>();
    const stats = papers.map((d) => (d.data().scoreStats as ScoreStats | undefined) ?? filled.get(d.id)!);

    return papers
      .map((d, i) => {
        const p = d.data();
        const st = stats[i];
        return {
          examId: d.id,
          classId: p.classId as string,
          subjectId: p.subjectId as string,
          subject: p.title as string,
          students: sizes.get(p.classId) ?? 0,
          complete: st.complete,
          started: st.started,
          average: st.complete ? round1(st.sum / st.complete) : null,
          mine: scope ? scope.canScore(p.classId, p.subjectId) && !scope.all : false,
          canEdit: scope ? scope.canScore(p.classId, p.subjectId) : true,
        };
      })
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }

  /**
   * Works out score summaries for papers scored before summaries were kept, in one pass over the
   * exam's results, and stores them so later views are cheap. Only current students in each class count.
   */
  private async backfillStats(schoolId: string, seriesId: string, papers: FirebaseFirestore.QueryDocumentSnapshot[]) {
    const classIds = [...new Set(papers.map((p) => p.data().classId as string))];
    const [resultSnap, ...classStudents] = await Promise.all([
      this.col.where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get(),
      ...classIds.map((c) => this.db.collection('students').where('schoolId', '==', schoolId).where('classId', '==', c).where('status', '==', 'ACTIVE').get()),
    ]);
    const inClass = new Map(classIds.map((c, i) => [c, new Set(classStudents[i].docs.map((d) => d.id))]));
    const out = new Map<string, ScoreStats>();
    const batch = this.db.batch();
    for (const p of papers) {
      const members = inClass.get(p.data().classId)!;
      const rows = resultSnap.docs.map((r) => r.data()).filter((r) => r.examId === p.id && members.has(r.studentId));
      const st = statsOf(rows.map((r) => ({ ca: r.ca ?? null, exam: r.exam ?? null, total: typeof r.score === 'number' ? r.score : null })));
      out.set(p.id, st);
      batch.update(p.ref, { scoreStats: st });
    }
    await batch.commit();
    return out;
  }

  /** Highest scores entered for a paper, so its max score can't be lowered below them. */
  async highestScores(schoolId: string, examId: string) {
    const snap = await this.col.where('schoolId', '==', schoolId).where('examId', '==', examId).get();
    return snap.docs.reduce(
      (m, d) => ({ ca: Math.max(m.ca, d.data().ca ?? 0), exam: Math.max(m.exam, d.data().exam ?? 0) }),
      { ca: 0, exam: 0 },
    );
  }

  async findAll(schoolId: string, query: Record<string, string>, user?: JwtPayload) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);
    if (query.examId) ref = ref.where('examId', '==', query.examId);
    if (query.studentId) ref = ref.where('studentId', '==', query.studentId);
    const [snapshot, scope] = await Promise.all([ref.get(), user ? TeachingScope.load(this.db as any, user) : Promise.resolve(null)]);
    return snapshot.docs.filter((d) => !scope || scope.canViewClass(d.data().classId)).map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async count(schoolId: string) {
    return countOf(this.col.where('schoolId', '==', schoolId));
  }
}
