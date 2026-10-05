import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { countOf } from '../../common/aggregate';

/** "JSS 2B", "JSS2B" and "jss-2b" are the same class name. */
const nameKey = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');

@Injectable()
export class ClassesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('classes');
  }

  /** Names of this school's active classes, keyed by normalised name. */
  private async activeNames(schoolId: string, exceptId?: string) {
    const snap = await this.col.where('schoolId', '==', schoolId).get();
    const names = new Map<string, string>();
    for (const doc of snap.docs) {
      const d = doc.data();
      if (doc.id !== exceptId && d.status !== 'INACTIVE' && d.name) names.set(nameKey(d.name), d.name);
    }
    return names;
  }

  private async assertNameFree(schoolId: string, name: string, exceptId?: string) {
    const existing = (await this.activeNames(schoolId, exceptId)).get(nameKey(name));
    if (existing) {
      throw new BadRequestException(`A class named "${existing}" already exists. Use a different name.`);
    }
  }

  async create(schoolId: string, dto: CreateClassDto) {
    await this.assertNameFree(schoolId, dto.name);
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      teacherId: dto.teacherId || null,
      capacity: dto.capacity || 40,
      studentIds: [],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto, studentIds: [], status: 'ACTIVE' };
  }

  async findAll(schoolId: string, name?: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    results.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
      return bTime - aTime;
    });

    if (name) {
      const s = name.toLowerCase();
      results = results.filter((r: any) => r.name?.toLowerCase().includes(s));
    }
    return results;
  }

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Class not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(schoolId: string, id: string, dto: UpdateClassDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Class not found');
    // Only check when the name actually changes, so existing twins can still be edited.
    if (dto.name && nameKey(dto.name) !== nameKey(doc.data()!.name ?? '')) {
      await this.assertNameFree(schoolId, dto.name, id);
    }
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Class not found');
    const students = await this.firebase.firestore
      .collection('students')
      .where('schoolId', '==', schoolId)
      .where('classId', '==', id)
      .get();
    const activeStudents = students.docs.filter((d) => d.data().status !== 'INACTIVE').length;
    if (activeStudents > 0) {
      throw new BadRequestException({
        code: 'CLASS_HAS_STUDENTS',
        count: activeStudents,
        message: `"${doc.data()!.name}" still has ${activeStudents} ${activeStudents === 1 ? 'student' : 'students'}. Move them to another class first.`,
      });
    }
    await doc.ref.update({ status: 'INACTIVE', updatedAt: new Date() });
    return { message: 'Class deleted' };
  }

  async bulkCreate(schoolId: string, records: any[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: any[] = [];
    const taken = await this.activeNames(schoolId);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name || !r.gradeLevel) {
        errors.push({ row: i + 1, message: 'Missing required fields: name, gradeLevel' });
        continue;
      }
      const existing = taken.get(nameKey(String(r.name)));
      if (existing) {
        errors.push({ row: i + 1, message: `A class named "${existing}" already exists, so this row was skipped.` });
        continue;
      }
      taken.set(nameKey(String(r.name)), String(r.name));
      const ref = this.col.doc();
      batch.set(ref, {
        schoolId,
        name: r.name,
        gradeLevel: r.gradeLevel,
        teacherId: r.teacherId || null,
        capacity: r.capacity ? Number(r.capacity) : 40,
        studentIds: [],
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
      created.push({ id: ref.id, ...r });
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
