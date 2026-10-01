import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateTeachingAssignmentDto } from './dto/create-teaching-assignment.dto';
import { UpdateTeachingAssignmentDto } from './dto/update-teaching-assignment.dto';
import { QueryTeachingAssignmentDto } from './dto/query-teaching-assignment.dto';

/** "JSS 1A", "JSS1A" and "jss-1a" are the same name. */
const looseKey = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');
const exactKey = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
const codeKey = (v: string) => v.toUpperCase().replace(/\s+/g, '');

type Named = { id: string; label: string };
type Resolved = { id: string } | { error: string };

/** Finds one record by a loosely matched key; prefers an exact spelling when several match. */
function pick(matches: Named[], wanted: string, what: string): Resolved {
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length === 0) return { error: `${what} "${wanted}" not found.` };
  const exact = matches.filter((m) => exactKey(m.label) === exactKey(wanted));
  if (exact.length === 1) return { id: exact[0].id };
  return { error: `More than one ${what.toLowerCase()} matches "${wanted}". Use a unique name, code or email.` };
}

@Injectable()
export class TeachingAssignmentsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get col() {
    return this.db.collection('teachingAssignments');
  }

  /** Loads a class, subject or teacher of this school and checks it is still active. */
  private async activeDoc(collection: string, id: string, schoolId: string, what: string) {
    const doc = await getOwnedDoc(this.db.collection(collection), id, schoolId, `${what} not found`);
    if (doc.data()!.status === 'INACTIVE') {
      throw new BadRequestException(`That ${what.toLowerCase()} has been ${collection === 'subjects' ? 'archived' : 'deleted'}.`);
    }
    return doc;
  }

  async list(schoolId: string, query: QueryTeachingAssignmentDto) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);
    if (query.classId) ref = ref.where('classId', '==', query.classId);
    if (query.subjectId) ref = ref.where('subjectId', '==', query.subjectId);
    if (query.teacherId) ref = ref.where('teacherId', '==', query.teacherId);
    const snap = await ref.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async create(schoolId: string, dto: CreateTeachingAssignmentDto) {
    const cls = await this.activeDoc('classes', dto.classId, schoolId, 'Class');
    const subject = await this.activeDoc('subjects', dto.subjectId, schoolId, 'Subject');
    if (dto.teacherId) await this.activeDoc('teachers', dto.teacherId, schoolId, 'Teacher');

    const existing = await this.col
      .where('schoolId', '==', schoolId)
      .where('classId', '==', dto.classId)
      .where('subjectId', '==', dto.subjectId)
      .get();
    if (!existing.empty) {
      throw new BadRequestException(`${cls.data()!.name} already takes ${subject.data()!.name}. Change its teacher instead.`);
    }

    const now = new Date();
    const record = { schoolId, classId: dto.classId, subjectId: dto.subjectId, teacherId: dto.teacherId || null, createdAt: now, updatedAt: now };
    const ref = await this.col.add(record);
    return { id: ref.id, ...record };
  }

  async update(schoolId: string, id: string, dto: UpdateTeachingAssignmentDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Assignment not found');
    if (dto.teacherId) await this.activeDoc('teachers', dto.teacherId, schoolId, 'Teacher');
    const teacherId = dto.teacherId || null;
    await doc.ref.update({ teacherId, updatedAt: new Date() });
    return { id, ...doc.data(), teacherId };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Assignment not found');
    await doc.ref.delete();
    return { message: 'Subject removed from class' };
  }

  /**
   * Imports rows of { className, subject, teacher }. Subject matches by code or name;
   * teacher by email, employee number or full name. Existing class–subject pairs are skipped.
   */
  async bulkCreate(schoolId: string, records: Record<string, any>[]) {
    const [classSnap, subjectSnap, teacherSnap, existingSnap] = await Promise.all(
      ['classes', 'subjects', 'teachers', 'teachingAssignments'].map((c) => this.db.collection(c).where('schoolId', '==', schoolId).get()),
    );
    const active = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.filter((d) => d.data().status !== 'INACTIVE');

    const classes = active(classSnap).map((d) => ({ id: d.id, label: String(d.data().name ?? '') }));
    const subjects = active(subjectSnap).map((d) => ({ id: d.id, label: String(d.data().name ?? ''), code: String(d.data().code ?? '') }));
    const teachers = active(teacherSnap).map((d) => {
      const t = d.data();
      return {
        id: d.id,
        label: `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim(),
        email: String(t.email ?? '').toLowerCase().trim(),
        employeeNumber: codeKey(String(t.employeeNumber ?? '')),
      };
    });
    const names = new Map([...classSnap.docs, ...subjectSnap.docs].map((d) => [d.id, String(d.data().name ?? '')]));
    const pairs = new Map(existingSnap.docs.map((d) => [`${d.data().classId}|${d.data().subjectId}`, 'existing']));

    const findClass = (v: string) => pick(classes.filter((c) => looseKey(c.label) === looseKey(v)), v, 'Class');
    const findSubject = (v: string): Resolved => {
      const byCode = subjects.filter((s) => s.code && codeKey(s.code) === codeKey(v));
      if (byCode.length === 1) return { id: byCode[0].id };
      return pick(subjects.filter((s) => looseKey(s.label) === looseKey(v)), v, 'Subject');
    };
    const findTeacher = (v: string): Resolved => {
      const lower = v.toLowerCase().trim();
      const byEmail = teachers.filter((t) => t.email && t.email === lower);
      if (byEmail.length === 1) return { id: byEmail[0].id };
      const byNumber = teachers.filter((t) => t.employeeNumber && t.employeeNumber === codeKey(v));
      if (byNumber.length === 1) return { id: byNumber[0].id };
      return pick(teachers.filter((t) => looseKey(t.label) === looseKey(v)), v, 'Teacher');
    };

    const now = new Date();
    const batch = this.db.batch();
    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    records.forEach((r, i) => {
      const row = i + 1;
      const className = String(r.className ?? '').trim();
      const subjectValue = String(r.subject ?? '').trim();
      const teacherValue = String(r.teacher ?? '').trim();
      if (!className || !subjectValue) {
        errors.push({ row, message: 'Missing required fields: Class, Subject' });
        return;
      }
      const cls = findClass(className);
      if ('error' in cls) return errors.push({ row, message: `${cls.error} Create it on the Classes page or check the spelling.` });
      const subject = findSubject(subjectValue);
      if ('error' in subject) return errors.push({ row, message: `${subject.error} Add it on the Subjects page or check the spelling.` });
      let teacherId: string | null = null;
      if (teacherValue) {
        const teacher = findTeacher(teacherValue);
        if ('error' in teacher) return errors.push({ row, message: `${teacher.error} Add them on the Teachers page, or use their email.` });
        teacherId = teacher.id;
      }
      const key = `${cls.id}|${subject.id}`;
      if (pairs.has(key)) {
        const seenRow = pairs.get(key);
        errors.push({
          row,
          message:
            seenRow === 'existing'
              ? `${names.get(cls.id)} already takes ${names.get(subject.id)}, so this row was skipped.`
              : `${names.get(cls.id)} – ${names.get(subject.id)} is also on row ${seenRow} of this file, so this row was skipped.`,
        });
        return;
      }
      pairs.set(key, String(row));
      batch.set(this.col.doc(), { schoolId, classId: cls.id, subjectId: subject.id, teacherId, createdAt: now, updatedAt: now });
      imported++;
    });

    if (imported > 0) await batch.commit();
    return { imported, errors };
  }
}
