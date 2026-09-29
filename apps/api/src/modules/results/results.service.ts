import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
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

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Result not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(schoolId: string, id: string, dto: UpdateResultDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Result not found');
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Result not found');
    await doc.ref.delete();
    return { message: 'Result deleted' };
  }

  async count(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
