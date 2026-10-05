import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { isIsoDate, schoolToday } from '../../common/school-date';
import { AddPapersDto, CreateExamSeriesDto, TERM_LABEL, UpdateExamSeriesDto } from './dto/exam-series.dto';
import { UpdatePaperDto } from './dto/update-paper.dto';
import { countOf } from '../../common/aggregate';

export type SeriesStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Paper {
  id: string;
  seriesId: string;
  classId: string;
  subjectId: string;
  title: string;
  date: string | null;
  startTime: string | null;
  durationMinutes: number;
  maxScore: number;
  teacherId?: string | null;
}

export interface Clash {
  date: string;
  reason: 'CLASS' | 'TEACHER';
  paperIds: [string, string];
}

const looseKey = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');
const codeKey = (v: string) => v.toUpperCase().replace(/\s+/g, '');

/** "08:30" -> 510 minutes after midnight; null if not a valid 24-hour time. */
export const toMinutes = (time: string): number | null => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Accepts "8:30", "08:30", "8.30", "2:00 pm" from spreadsheets and returns "HH:MM", or null. */
export const normaliseTime = (raw: string): string | null => {
  const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i.exec(raw.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/** Two scheduled papers clash if they overlap on the same day and share a class or a teacher. */
export function findClashes(papers: Paper[]): Clash[] {
  const scheduled = papers.filter((p) => p.date && p.startTime && toMinutes(p.startTime) !== null);
  const clashes: Clash[] = [];
  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const a = scheduled[i];
      const b = scheduled[j];
      if (a.date !== b.date) continue;
      const aStart = toMinutes(a.startTime!)!;
      const bStart = toMinutes(b.startTime!)!;
      const overlap = aStart < bStart + b.durationMinutes && bStart < aStart + a.durationMinutes;
      if (!overlap) continue;
      if (a.classId === b.classId) clashes.push({ date: a.date!, reason: 'CLASS', paperIds: [a.id, b.id] });
      else if (a.teacherId && a.teacherId === b.teacherId) clashes.push({ date: a.date!, reason: 'TEACHER', paperIds: [a.id, b.id] });
    }
  }
  return clashes;
}

export function seriesStatus(startDate: string, endDate: string, total: number, scheduled: number, today = schoolToday()): SeriesStatus {
  if (today > endDate) return 'COMPLETED';
  if (today >= startDate) return 'IN_PROGRESS';
  return total > 0 && scheduled === total ? 'SCHEDULED' : 'DRAFT';
}

@Injectable()
export class ExamsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  /** Exam papers (one per class and subject in a series). */
  private get col() {
    return this.db.collection('exams');
  }

  private get seriesCol() {
    return this.db.collection('examSeries');
  }

  private paperId = (seriesId: string, classId: string, subjectId: string) => `${seriesId}__${classId}__${subjectId}`;

  private checkDates(startDate: string, endDate: string) {
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) throw new BadRequestException('Use dates like 2026-10-12.');
    if (endDate < startDate) throw new BadRequestException('The end date must be on or after the start date.');
  }

  private async activeClasses(schoolId: string) {
    const snap = await this.db.collection('classes').where('schoolId', '==', schoolId).get();
    return new Map(snap.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => [d.id, String(d.data().name ?? '')]));
  }

  private async papersOf(schoolId: string, seriesId: string): Promise<Paper[]> {
    const snap = await this.col.where('schoolId', '==', schoolId).where('seriesId', '==', seriesId).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Paper, 'id'>) }));
  }

  /** Teacher for each class+subject, from Class subjects. */
  private async teacherMap(schoolId: string) {
    const snap = await this.db.collection('teachingAssignments').where('schoolId', '==', schoolId).get();
    return new Map(snap.docs.map((d) => [`${d.data().classId}|${d.data().subjectId}`, (d.data().teacherId as string | null) ?? null]));
  }

  /** Creates any missing papers for the given classes from their Class subjects. */
  private async generatePapers(schoolId: string, series: { id: string; defaultMaxScore: number; defaultDurationMinutes: number }, classIds: string[], classNames: Map<string, string>) {
    const [assignSnap, subjectSnap, existing] = await Promise.all([
      this.db.collection('teachingAssignments').where('schoolId', '==', schoolId).get(),
      this.db.collection('subjects').where('schoolId', '==', schoolId).get(),
      this.papersOf(schoolId, series.id),
    ]);
    const activeSubjects = new Map(subjectSnap.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => [d.id, String(d.data().name ?? '')]));
    const have = new Set(existing.map((p) => p.id));
    const now = new Date();
    const batch = this.db.batch();
    let created = 0;
    const classesWithoutSubjects: string[] = [];

    for (const classId of classIds) {
      const subjects = assignSnap.docs.filter((d) => d.data().classId === classId && activeSubjects.has(d.data().subjectId)).map((d) => d.data().subjectId as string);
      if (subjects.length === 0) classesWithoutSubjects.push(classNames.get(classId) ?? classId);
      for (const subjectId of subjects) {
        const id = this.paperId(series.id, classId, subjectId);
        if (have.has(id)) continue;
        batch.set(this.col.doc(id), {
          schoolId,
          seriesId: series.id,
          classId,
          subjectId,
          title: activeSubjects.get(subjectId),
          date: null,
          startTime: null,
          durationMinutes: series.defaultDurationMinutes,
          maxScore: series.defaultMaxScore,
          scoreStats: { complete: 0, started: 0, sum: 0 },
          createdAt: now,
          updatedAt: now,
        });
        created++;
      }
    }
    if (created > 0) await batch.commit();
    return { created, classesWithoutSubjects };
  }

  private async assertNameFree(schoolId: string, name: string, exceptId?: string) {
    const snap = await this.seriesCol.where('schoolId', '==', schoolId).get();
    const clash = snap.docs.find((d) => d.id !== exceptId && looseKey(String(d.data().name ?? '')) === looseKey(name));
    if (clash) throw new BadRequestException(`An exam called "${clash.data().name}" already exists.`);
  }

  async createSeries(schoolId: string, dto: CreateExamSeriesDto) {
    const [y1, y2] = dto.session.split('/').map(Number);
    if (y2 !== y1 + 1) throw new BadRequestException('Session must be two consecutive years, like 2026/2027.');
    this.checkDates(dto.startDate, dto.endDate);
    const classIds = [...new Set(dto.classIds)];
    if (classIds.length === 0) throw new BadRequestException('Choose at least one class.');
    const classNames = await this.activeClasses(schoolId);
    if (classIds.some((id) => !classNames.has(id))) throw new BadRequestException("One of the chosen classes wasn't found. Refresh and try again.");

    const name = (dto.name?.trim() || `${TERM_LABEL[dto.term]} Examination ${dto.session}`).replace(/\s+/g, ' ');
    await this.assertNameFree(schoolId, name);

    const now = new Date();
    const record = {
      schoolId,
      name,
      term: dto.term,
      session: dto.session,
      startDate: dto.startDate,
      endDate: dto.endDate,
      classIds,
      defaultMaxScore: dto.defaultMaxScore ?? 60,
      defaultDurationMinutes: dto.defaultDurationMinutes ?? 120,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await this.seriesCol.add(record);
    const generated = await this.generatePapers(schoolId, { id: ref.id, ...record }, classIds, classNames);
    return { id: ref.id, ...record, ...generated };
  }

  private summarise(series: { id: string; startDate: string; endDate: string; [key: string]: any }, papers: Paper[]) {
    const scheduled = papers.filter((p) => p.date && p.startTime).length;
    return {
      ...series,
      papers: papers.length,
      scheduled,
      clashCount: findClashes(papers).length,
      status: seriesStatus(series.startDate, series.endDate, papers.length, scheduled),
    };
  }

  async listSeries(schoolId: string) {
    const [seriesSnap, paperSnap, teachers] = await Promise.all([
      this.seriesCol.where('schoolId', '==', schoolId).get(),
      this.col.where('schoolId', '==', schoolId).get(),
      this.teacherMap(schoolId),
    ]);
    const papers = paperSnap.docs
      .filter((d) => d.data().seriesId)
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Paper, 'id'>), teacherId: teachers.get(`${d.data().classId}|${d.data().subjectId}`) ?? null }));
    return seriesSnap.docs
      .map((d) => this.summarise({ id: d.id, ...(d.data() as any) }, papers.filter((p) => p.seriesId === d.id)))
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  }

  async getSeries(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.seriesCol, id, schoolId, 'Exam not found');
    const [papers, teachers] = await Promise.all([this.papersOf(schoolId, id), this.teacherMap(schoolId)]);
    const withTeachers = papers
      .map((p) => ({ ...p, teacherId: teachers.get(`${p.classId}|${p.subjectId}`) ?? null }))
      .sort((a, b) => `${a.date ?? '9999'} ${a.startTime ?? '99'}`.localeCompare(`${b.date ?? '9999'} ${b.startTime ?? '99'}`));
    return { ...this.summarise({ id: doc.id, ...(doc.data() as any) }, withTeachers), paperList: withTeachers, clashes: findClashes(withTeachers) };
  }

  async updateSeries(schoolId: string, id: string, dto: UpdateExamSeriesDto) {
    const doc = await getOwnedDoc(this.seriesCol, id, schoolId, 'Exam not found');
    const current = doc.data()!;
    const startDate = dto.startDate ?? current.startDate;
    const endDate = dto.endDate ?? current.endDate;
    this.checkDates(startDate, endDate);
    const outside = (await this.papersOf(schoolId, id)).filter((p) => p.date && (p.date < startDate || p.date > endDate));
    if (outside.length > 0) {
      throw new BadRequestException(`${outside.length} ${outside.length === 1 ? 'paper is' : 'papers are'} scheduled outside these dates. Move ${outside.length === 1 ? 'it' : 'them'} first.`);
    }
    const changes: Record<string, any> = { startDate, endDate, updatedAt: new Date() };
    if (dto.name !== undefined) {
      const name = dto.name.trim().replace(/\s+/g, ' ');
      if (!name) throw new BadRequestException('Give the exam a name.');
      await this.assertNameFree(schoolId, name, id);
      changes.name = name;
    }
    await doc.ref.update(changes);
    return this.getSeries(schoolId, id);
  }

  /** Adds classes to the series and creates any papers that are missing (e.g. subjects added since). */
  async addPapers(schoolId: string, id: string, dto: AddPapersDto) {
    const doc = await getOwnedDoc(this.seriesCol, id, schoolId, 'Exam not found');
    const series = { id: doc.id, ...doc.data()! } as any;
    const classNames = await this.activeClasses(schoolId);
    const extra = [...new Set(dto.classIds ?? [])];
    if (extra.some((c) => !classNames.has(c))) throw new BadRequestException("One of the chosen classes wasn't found. Refresh and try again.");
    const classIds = [...new Set([...(series.classIds as string[]), ...extra])].filter((c) => classNames.has(c));
    if (extra.length) await doc.ref.update({ classIds, updatedAt: new Date() });
    return this.generatePapers(schoolId, series, classIds, classNames);
  }

  /** Paper IDs that already have scores entered against them. */
  private async papersWithResults(schoolId: string, paperIds: string[]) {
    const ids = new Set(paperIds);
    const snap = await this.db.collection('examResults').where('schoolId', '==', schoolId).get();
    return new Set(snap.docs.map((d) => d.data().examId as string).filter((e) => ids.has(e)));
  }

  async deleteSeries(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.seriesCol, id, schoolId, 'Exam not found');
    const papers = await this.papersOf(schoolId, id);
    if ((await this.papersWithResults(schoolId, papers.map((p) => p.id))).size > 0) {
      throw new BadRequestException("Scores have already been entered for this exam, so it can't be deleted.");
    }
    const batch = this.db.batch();
    papers.forEach((p) => batch.delete(this.col.doc(p.id)));
    batch.delete(doc.ref);
    await batch.commit();
    return { message: 'Exam deleted' };
  }

  async updatePaper(schoolId: string, id: string, dto: UpdatePaperDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Paper not found');
    const paper = doc.data()!;
    if (!paper.seriesId) throw new BadRequestException('This exam was made with the old form. Create a new exam series instead.');
    const series = (await this.seriesCol.doc(paper.seriesId).get()).data()!;
    const changes: Record<string, any> = {};

    if (dto.date === null) {
      changes.date = null;
      changes.startTime = null;
    } else if (dto.date !== undefined) {
      if (!isIsoDate(dto.date)) throw new BadRequestException('Use a date like 2026-10-12.');
      if (dto.date < series.startDate || dto.date > series.endDate) throw new BadRequestException(`Choose a date between ${series.startDate} and ${series.endDate}.`);
      changes.date = dto.date;
    }
    if (dto.startTime !== undefined && dto.date !== null) {
      if (dto.startTime === null) changes.startTime = null;
      else {
        const time = normaliseTime(dto.startTime);
        if (!time) throw new BadRequestException('Use a time like 09:00.');
        if (!(changes.date ?? paper.date)) throw new BadRequestException('Choose a date first.');
        changes.startTime = time;
      }
    }
    if (dto.durationMinutes !== undefined) changes.durationMinutes = dto.durationMinutes;
    if (dto.maxScore !== undefined && dto.maxScore !== paper.maxScore) {
      // Scores already entered must still fit: exam within the new max, CA within what's left of 100.
      const results = await this.db.collection('examResults').where('schoolId', '==', schoolId).where('examId', '==', id).get();
      const topExam = Math.max(0, ...results.docs.map((d) => d.data().exam ?? 0));
      const topCa = Math.max(0, ...results.docs.map((d) => d.data().ca ?? 0));
      if (topExam > dto.maxScore) throw new BadRequestException(`A student already scored ${topExam} on this paper, so the max score can't be below that.`);
      if (topCa > 100 - dto.maxScore) throw new BadRequestException(`A student already has ${topCa} for CA, so the max score can't be above ${100 - topCa}.`);
      changes.maxScore = dto.maxScore;
    }

    await doc.ref.update({ ...changes, updatedAt: new Date() });
    return { id, ...paper, ...changes };
  }

  async deletePaper(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Paper not found');
    if ((await this.papersWithResults(schoolId, [id])).size > 0) {
      throw new BadRequestException("Scores have already been entered for this paper, so it can't be removed.");
    }
    await doc.ref.delete();
    return { message: 'Paper removed' };
  }

  /** Imports dates and times from a spreadsheet: Class, Subject, Date, Start Time, Duration, Max Score. */
  async importSchedule(schoolId: string, id: string, records: Record<string, any>[]) {
    const doc = await getOwnedDoc(this.seriesCol, id, schoolId, 'Exam not found');
    const series = doc.data()!;
    const [papers, classNames, subjectSnap] = await Promise.all([
      this.papersOf(schoolId, id),
      this.activeClasses(schoolId),
      this.db.collection('subjects').where('schoolId', '==', schoolId).get(),
    ]);
    const subjects = subjectSnap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? ''), code: String(d.data().code ?? '') }));
    const errors: { row: number; message: string }[] = [];
    const batch = this.db.batch();
    let imported = 0;

    records.forEach((r, i) => {
      const row = i + 1;
      const className = String(r.className ?? '').trim();
      const subjectValue = String(r.subject ?? '').trim();
      const date = String(r.date ?? '').trim();
      const time = String(r.startTime ?? '').trim();
      if (!className || !subjectValue || !date || !time) return errors.push({ row, message: 'Missing required fields: Class, Subject, Date, Start Time' });

      const classMatches = [...classNames.entries()].filter(([cid, n]) => (series.classIds as string[]).includes(cid) && looseKey(n) === looseKey(className));
      if (classMatches.length !== 1) return errors.push({ row, message: `Class "${className}" isn't in this exam.` });
      const subjectMatches = subjects.filter((s) => codeKey(s.code) === codeKey(subjectValue)).length === 1
        ? subjects.filter((s) => codeKey(s.code) === codeKey(subjectValue))
        : subjects.filter((s) => looseKey(s.name) === looseKey(subjectValue));
      const paper = subjectMatches.length === 1 ? papers.find((p) => p.classId === classMatches[0][0] && p.subjectId === subjectMatches[0].id) : undefined;
      if (!paper) return errors.push({ row, message: `${classMatches[0][1]} doesn't have a "${subjectValue}" paper in this exam.` });

      if (!isIsoDate(date)) return errors.push({ row, message: `Date "${date}" should look like 2026-10-12.` });
      if (date < series.startDate || date > series.endDate) return errors.push({ row, message: `${date} is outside this exam (${series.startDate} to ${series.endDate}).` });
      const startTime = normaliseTime(time);
      if (!startTime) return errors.push({ row, message: `Time "${time}" should look like 09:00.` });
      const duration = r.duration ? Number(r.duration) : undefined;
      if (duration !== undefined && (!Number.isInteger(duration) || duration < 15 || duration > 480)) return errors.push({ row, message: 'Duration should be minutes between 15 and 480.' });
      const maxScore = r.maxScore ? Number(r.maxScore) : undefined;
      if (maxScore !== undefined && (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 100)) return errors.push({ row, message: 'Max score should be a whole number from 1 to 100.' });

      batch.update(this.col.doc(paper.id), {
        date,
        startTime,
        ...(duration !== undefined ? { durationMinutes: duration } : {}),
        ...(maxScore !== undefined ? { maxScore } : {}),
        updatedAt: new Date(),
      });
      imported++;
    });
    if (imported > 0) await batch.commit();
    return { imported, errors };
  }

  async setPublished(schoolId: string, id: string, published: boolean) {
    const doc = await getOwnedDoc(this.seriesCol, id, schoolId, 'Exam not found');
    await doc.ref.update({ resultsPublished: published, publishedAt: published ? new Date() : null, updatedAt: new Date() });
    return { id, resultsPublished: published };
  }

  /** The exam in progress, or the next one coming up, for the dashboard. */
  async upcoming(schoolId: string) {
    const today = schoolToday();
    const snap = await this.seriesCol.where('schoolId', '==', schoolId).get();
    const live = snap.docs
      .map((d) => ({ id: d.id, name: d.data().name, startDate: d.data().startDate, endDate: d.data().endDate }))
      .filter((s) => s.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const next = live[0];
    return next ? { ...next, inProgress: next.startDate <= today } : null;
  }

  async findAll(schoolId: string, query: Record<string, string>) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);
    if (query.classId) ref = ref.where('classId', '==', query.classId);
    if (query.subjectId) ref = ref.where('subjectId', '==', query.subjectId);
    if (query.seriesId) ref = ref.where('seriesId', '==', query.seriesId);
    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async count(schoolId: string) {
    return countOf(this.col.where('schoolId', '==', schoolId));
  }
}
