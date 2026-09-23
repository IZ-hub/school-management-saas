import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
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

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Student not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, dto: UpdateStudentDto) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Student not found');
    await this.col.doc(id).update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Student not found');
    await this.col.doc(id).update({ status: 'INACTIVE', updatedAt: new Date() });
    return { message: 'Student deactivated' };
  }

  async bulkCreate(schoolId: string, records: Partial<CreateStudentDto>[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.firstName || !r.lastName || !r.admissionNumber) {
        errors.push({ row: i + 1, message: 'Missing required fields: firstName, lastName, admissionNumber' });
        continue;
      }
      const ref = this.col.doc();
      batch.set(ref, {
        schoolId,
        firstName: r.firstName,
        lastName: r.lastName,
        dateOfBirth: r.dateOfBirth || '',
        gender: r.gender || '',
        admissionNumber: r.admissionNumber,
        classId: r.classId || null,
        section: r.section || null,
        parentEmail: r.parentEmail || null,
        parentPhone: r.parentPhone || null,
        address: r.address || null,
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
