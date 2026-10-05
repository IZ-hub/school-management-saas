import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { countOf } from '../../common/aggregate';

@Injectable()
export class StudentsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('students');
  }

  async create(schoolId: string, dto: CreateStudentDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto, status: 'ACTIVE' };
  }

  async findAll(schoolId: string, search?: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    results.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
      return bTime - aTime;
    });

    if (search) {
      const s = search.toLowerCase();
      results = results.filter(
        (r: any) =>
          r.firstName?.toLowerCase().includes(s) ||
          r.lastName?.toLowerCase().includes(s) ||
          r.admissionNumber?.toLowerCase().includes(s),
      );
    }
    return results;
  }

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(schoolId: string, id: string, dto: UpdateStudentDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    await doc.ref.update({ status: 'INACTIVE', updatedAt: new Date() });
    return { message: 'Student deactivated' };
  }

  /**
   * Resolves an imported class to this school's class ID. Accepts a class name
   * ("JSS 1A", matched ignoring case, spaces, hyphens and dots) or one of the school's class IDs.
   * When several classes match loosely, a class spelled exactly as written wins.
   */
  private async classResolver(schoolId: string) {
    const snap = await this.firebase.firestore.collection('classes').where('schoolId', '==', schoolId).get();
    // "JSS 1A", "JSS1A", "jss-1a" and "J.S.S 1A" are the same class: ignore case, spaces, hyphens and dots.
    const loose = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');
    const exact = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
    const ids = new Set<string>();
    const byName = new Map<string, { id: string; name: string }[]>();
    for (const doc of snap.docs) {
      ids.add(doc.id);
      const { name, status } = doc.data();
      if (!name || status === 'INACTIVE') continue;
      byName.set(loose(name), [...(byName.get(loose(name)) ?? []), { id: doc.id, name }]);
    }
    return (value: string): { classId: string } | { error: string } => {
      const wanted = value.trim();
      const matches = byName.get(loose(wanted)) ?? [];
      if (matches.length === 1) return { classId: matches[0].id };
      if (matches.length > 1) {
        const spelledExactly = matches.filter((m) => exact(m.name) === exact(wanted));
        if (spelledExactly.length === 1) return { classId: spelledExactly[0].id };
        const names = [...new Set(matches.map((m) => `"${m.name}"`))];
        return {
          error:
            names.length === 1
              ? `${matches.length} active classes are named ${names[0]}. Delete the extra one on the Classes page, then import again.`
              : `More than one class matches "${wanted}": ${names.join(' and ')}. Delete or rename the extra one on the Classes page, then import again.`,
        };
      }
      if (ids.has(wanted)) return { classId: wanted };
      return { error: `Class "${wanted}" not found. Create it on the Classes page or check the spelling.` };
    };
  }

  async bulkCreate(schoolId: string, records: (Partial<CreateStudentDto> & { className?: string })[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: any[] = [];
    const resolveClass = await this.classResolver(schoolId);

    // Skip students who are already in the school (or appear twice in the file), so a file can be re-imported safely.
    const admissionKey = (v: string) => v.toLowerCase().replace(/\s+/g, '');
    const existing = new Map<string, string>();
    const studentsSnap = await this.col.where('schoolId', '==', schoolId).get();
    for (const doc of studentsSnap.docs) {
      const d = doc.data();
      if (d.admissionNumber) existing.set(admissionKey(String(d.admissionNumber)), `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim());
    }
    const seenInFile = new Map<string, number>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.firstName || !r.lastName || !r.admissionNumber) {
        errors.push({ row: i + 1, message: 'Missing required fields: firstName, lastName, admissionNumber' });
        continue;
      }
      const key = admissionKey(String(r.admissionNumber));
      if (existing.has(key)) {
        errors.push({ row: i + 1, message: `Admission number ${r.admissionNumber} already belongs to ${existing.get(key) || 'a student'}, so this row was skipped.` });
        continue;
      }
      if (seenInFile.has(key)) {
        errors.push({ row: i + 1, message: `Admission number ${r.admissionNumber} is also on row ${seenInFile.get(key)} of this file, so this row was skipped.` });
        continue;
      }
      let classId: string | null = null;
      const wantedClass = (r.className || r.classId || '').toString();
      if (wantedClass.trim()) {
        const resolved = resolveClass(wantedClass);
        if ('error' in resolved) {
          errors.push({ row: i + 1, message: resolved.error });
          continue;
        }
        classId = resolved.classId;
      }
      const ref = this.col.doc();
      batch.set(ref, {
        schoolId,
        firstName: r.firstName,
        lastName: r.lastName,
        dateOfBirth: r.dateOfBirth || '',
        gender: r.gender || '',
        admissionNumber: r.admissionNumber,
        classId,
        section: r.section || null,
        parentEmail: r.parentEmail || null,
        parentPhone: r.parentPhone || null,
        address: r.address || null,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
      created.push({ id: ref.id, ...r, classId });
      seenInFile.set(key, i + 1);
    }

    if (created.length > 0) await batch.commit();
    return { imported: created.length, errors };
  }

  async count(schoolId: string) {
    return countOf(this.col
      .where('schoolId', '==', schoolId)
      .where('status', '==', 'ACTIVE'));
  }
}
