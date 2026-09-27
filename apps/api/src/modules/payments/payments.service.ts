import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
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
    // The fee must belong to this school; otherwise a payment could mark another school's fee as paid.
    const feeDoc = await getOwnedDoc(
      this.firebase.firestore.collection('fees'),
      dto.feeId,
      schoolId,
      'Fee not found',
    );

    const docRef = await this.col.add({
      schoolId,
      ...dto,
      reference: dto.reference || null,
      createdAt: now,
      updatedAt: now,
    });

    // Update fee status to PAID if full payment
    if (dto.amountPaid >= feeDoc.data()!.amount) {
      await feeDoc.ref.update({ status: 'PAID', updatedAt: now });
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

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Payment not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(schoolId: string, id: string, dto: UpdatePaymentDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Payment not found');
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Payment not found');
    await doc.ref.delete();
    return { message: 'Payment deleted' };
  }

  async count(schoolId: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    return snapshot.size;
  }
}
