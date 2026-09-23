import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateResultDto } from './dto/create-result.dto';
import { UpdateResultDto } from './dto/update-result.dto';

@Injectable()
export class ResultsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('examResults');
  }

  async create(schoolId: string, dto: CreateResultDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      grade: dto.grade || null,
      remarks: dto.remarks || null,
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto };
  }

  async findAll(schoolId: string, query: Record<string, string>) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);

    if (query.examId) ref = ref.where('examId', '==', query.examId);
    if (query.studentId) ref = ref.where('studentId', '==', query.studentId);

    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Result not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, dto: UpdateResultDto) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Result not found');
    await this.col.doc(id).update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Result not found');
    await this.col.doc(id).delete();
    return { message: 'Result deleted' };
  }

  async count(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
