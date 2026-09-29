import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('attendance');
  }

  async create(schoolId: string, recordedBy: string, dto: CreateAttendanceDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      recordedBy,
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto };
  }

  async findAll(schoolId: string, query: Record<string, string>) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);

    if (query.studentId) ref = ref.where('studentId', '==', query.studentId);
    if (query.classId) ref = ref.where('classId', '==', query.classId);
    if (query.subjectId) ref = ref.where('subjectId', '==', query.subjectId);
    if (query.date) ref = ref.where('date', '==', query.date);
    if (query.status) ref = ref.where('status', '==', query.status);

    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async update(schoolId: string, id: string, dto: UpdateAttendanceDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Attendance record not found');
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Attendance record not found');
    await doc.ref.delete();
    return { message: 'Attendance record deleted' };
  }

  async countPresent(schoolId: string) {
    const snapshot = await this.col
      .where('schoolId', '==', schoolId)
      .where('status', '==', 'PRESENT')
      .get();
    return snapshot.size;
  }

  async countTotal(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
