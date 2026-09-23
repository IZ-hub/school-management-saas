import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { QueryTimetableDto } from './dto/query-timetable.dto';

@Injectable()
export class TimetableService {
  constructor(private readonly firebase: FirebaseService) {}

  private get collection() {
    return this.firebase.firestore.collection('timetables');
  }

  async createTimetable(schoolId: string, body: CreateTimetableDto) {
    const docRef = await this.collection.add({
      schoolId,
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { id: docRef.id, ...body };
  }

  async listTimetables(schoolId: string, query: QueryTimetableDto) {
    let ref: FirebaseFirestore.Query = this.collection.where('schoolId', '==', schoolId);

    if (query.classId) ref = ref.where('classId', '==', query.classId);
    if (query.teacherId) ref = ref.where('teacherId', '==', query.teacherId);
    if (query.day) ref = ref.where('day', '==', query.day);

    const snapshot = await ref.get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async updateTimetable(id: string, body: UpdateTimetableDto) {
    await this.collection.doc(id).update({
      ...body,
      updatedAt: new Date(),
    });

    return {
      message: 'Timetable updated successfully',
      id,
      updatedFields: body,
    };
  }

  async deleteTimetable(id: string) {
    await this.collection.doc(id).delete();

    return {
      message: 'Timetable deleted successfully',
      id,
    };
  }
}
