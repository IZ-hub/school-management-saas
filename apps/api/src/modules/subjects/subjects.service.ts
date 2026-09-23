import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('subjects');
  }

  async create(schoolId: string, dto: CreateSubjectDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      teacherId: dto.teacherId || null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto, status: 'ACTIVE' };
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
      results = results.filter(
        (r: any) =>
          r.name?.toLowerCase().includes(s) || r.code?.toLowerCase().includes(s),
      );
    }
    return results;
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Subject not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Subject not found');
    await this.col.doc(id).update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Subject not found');
    await this.col.doc(id).update({ status: 'INACTIVE', updatedAt: new Date() });
    return { message: 'Subject deactivated' };
  }

  async bulkCreate(schoolId: string, records: any[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name || !r.code) {
        errors.push({ row: i + 1, message: 'Missing required fields: name, code' });
        continue;
      }
      const ref = this.col.doc();
      batch.set(ref, {
        schoolId,
        name: r.name,
        code: r.code,
        teacherId: r.teacherId || null,
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
    const snapshot = await this.col
      .where('schoolId', '==', schoolId)
      .where('status', '==', 'ACTIVE')
      .get();
    return snapshot.size;
  }
}
