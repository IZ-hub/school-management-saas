import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

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
   */
  private async classResolver(schoolId: string) {
    const snap = await this.firebase.firestore.collection('classes').where('schoolId', '==', schoolId).get();
    // "JSS 1A", "JSS1A", "jss-1a" and "J.S.S 1A" are the same class: ignore case, spaces, hyphens and dots.
    const norm = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');
    const ids = new Set<string>();
    const byName = new Map<string, string[]>();
    for (const doc of snap.docs) {
      ids.add(doc.id);
      const { name, status } = doc.data();
      if (!name || status === 'INACTIVE') continue;
      byName.set(norm(name), [...(byName.get(norm(name)) ?? []), doc.id]);
    }
    return (value: string): { classId: string } | { error: string } => {
      const matches = byName.get(norm(value)) ?? [];
      if (matches.length === 1) return { classId: matches[0] };
      if (matches.length > 1) return { error: `More than one class is named "${value.trim()}". Rename one of them, then import again.` };
      if (ids.has(value.trim())) return { classId: value.trim() };
      return { error: `Class "${value.trim()}" not found. Create it on the Classes page or check the spelling.` };
    };
  }

  async bulkCreate(schoolId: string, records: (Partial<CreateStudentDto> & { className?: string })[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: any[] = [];
    const resolveClass = await this.classResolver(schoolId);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.firstName || !r.lastName || !r.admissionNumber) {
        errors.push({ row: i + 1, message: 'Missing required fields: firstName, lastName, admissionNumber' });
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
    }

    if (created.length > 0) await batch.commit();
    return { imported: created.length, errors };
  }

  async count(schoolId: string) {
    const snapshot = await this.col
      .where('schoolId', '==', schoolId)
      .where('status', '==', 'ACTIVE')
      .get();
    return snapshot.size;
  }
}
