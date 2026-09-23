import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';

@Injectable()
export class FeesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('fees');
  }

  async create(schoolId: string, dto: CreateFeeDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      status: dto.status || 'PENDING',
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto, status: dto.status || 'PENDING' };
  }

  async findAll(schoolId: string, query: Record<string, string>) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);

    if (query.studentId) ref = ref.where('studentId', '==', query.studentId);
    if (query.classId) ref = ref.where('classId', '==', query.classId);
    if (query.term) ref = ref.where('term', '==', query.term);
    if (query.status) ref = ref.where('status', '==', query.status);

    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Fee not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, dto: UpdateFeeDto) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Fee not found');
    await this.col.doc(id).update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Fee not found');
    await this.col.doc(id).delete();
    return { message: 'Fee deleted' };
  }

  async count(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
