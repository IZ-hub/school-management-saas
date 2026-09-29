import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('exams');
  }

  async create(schoolId: string, dto: CreateExamDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      description: dto.description || null,
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto };
  }

  async findAll(schoolId: string, query: Record<string, string>) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);

    if (query.classId) ref = ref.where('classId', '==', query.classId);
    if (query.subjectId) ref = ref.where('subjectId', '==', query.subjectId);

    const snapshot = await ref.get();
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (query.title) {
      const s = query.title.toLowerCase();
      results = results.filter((r: any) => r.title?.toLowerCase().includes(s));
    }
    return results;
  }

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Exam not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(schoolId: string, id: string, dto: UpdateExamDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Exam not found');
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Exam not found');
    await doc.ref.delete();
    return { message: 'Exam deleted' };
  }

  async count(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
