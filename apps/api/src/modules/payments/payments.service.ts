import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('payments');
  }

  async create(schoolId: string, dto: CreatePaymentDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      reference: dto.reference || null,
      createdAt: now,
      updatedAt: now,
    });

    // Update fee status to PAID if full payment
    try {
      const feeDoc = await this.firebase.firestore
        .collection('fees')
        .doc(dto.feeId)
        .get();
      if (feeDoc.exists) {
        const feeData = feeDoc.data()!;
        if (dto.amountPaid >= feeData.amount) {
          await feeDoc.ref.update({ status: 'PAID', updatedAt: now });
        }
      }
    } catch {
      // Non-critical: fee status update failed
    }

    return { id: docRef.id, schoolId, ...dto };
  }

  async findAll(schoolId: string, query: Record<string, string>) {
    let ref: FirebaseFirestore.Query = this.col.where('schoolId', '==', schoolId);

    if (query.feeId) ref = ref.where('feeId', '==', query.feeId);
    if (query.studentId) ref = ref.where('studentId', '==', query.studentId);
    if (query.method) ref = ref.where('method', '==', query.method);

    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Payment not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Payment not found');
    await this.col.doc(id).update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Payment not found');
    await this.col.doc(id).delete();
    return { message: 'Payment deleted' };
  }

  async count(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
