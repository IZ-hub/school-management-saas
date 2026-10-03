import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { isIsoDate, schoolToday } from '../../common/school-date';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { FeesService, checkTermSession } from '../fees/fees.service';
import { RecordPaymentDto, VoidPaymentDto } from './dto/payments.dto';

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

@Injectable()
export class PaymentsService {
  constructor(private readonly firebase: FirebaseService, private readonly fees: FeesService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get col() {
    return this.db.collection('feePayments');
  }

  private async userName(user: JwtPayload) {
    const u = await this.db.collection('users').doc(user.sub).get();
    return u.exists ? `${u.data()!.firstName ?? ''} ${u.data()!.lastName ?? ''}`.trim() || user.email : user.email;
  }

  /** Records a payment against a student's fees for a term and gives it the next receipt number. */
  async record(schoolId: string, user: JwtPayload, dto: RecordPaymentDto) {
    checkTermSession(dto.term, dto.session);
    if (!isIsoDate(dto.paidOn)) throw new BadRequestException('Use a date like 2026-10-03.');
    if (dto.paidOn > schoolToday()) throw new BadRequestException("The payment date can't be in the future.");
    const statement = await this.fees.statement(schoolId, dto.studentId, dto.term, dto.session);
    const name = `${statement.student.firstName} ${statement.student.lastName}`.trim();
    if (!statement.feesSet) throw new BadRequestException(`Fees for ${statement.student.className ?? "this student's class"} haven't been set for this term yet.`);
    if (statement.balance <= 0) throw new BadRequestException(`${name} has already paid in full for this term.`);
    if (dto.amount > statement.balance) throw new BadRequestException(`${name} only owes ${naira(statement.balance)} for this term.`);

    return this.insert(schoolId, {
      studentId: dto.studentId,
      classId: statement.student.classId,
      term: dto.term,
      session: dto.session,
      amount: dto.amount,
      method: dto.method,
      paidOn: dto.paidOn,
      reference: dto.reference?.trim() || null,
      note: dto.note?.trim() || null,
      recordedBy: user.sub,
      recordedByName: await this.userName(user),
    });
  }

  /**
   * Records money already received online. Unlike a manual entry it isn't refused when it exceeds the
   * balance (e.g. a cash payment landed while the parent was paying); the extra shows as credit.
   */
  async recordOnline(schoolId: string, p: { studentId: string; term: string; session: string; amount: number; paidOn: string; reference: string; payerName: string }) {
    const statement = await this.fees.statement(schoolId, p.studentId, p.term, p.session);
    return this.insert(schoolId, {
      studentId: p.studentId,
      classId: statement.student.classId,
      term: p.term,
      session: p.session,
      amount: p.amount,
      method: 'ONLINE',
      paidOn: p.paidOn,
      reference: p.reference,
      note: `Paid online by ${p.payerName}`,
      recordedBy: 'paystack',
      recordedByName: 'Paystack (online)',
    });
  }

  /** Saves a payment with the next receipt number for its year. */
  private async insert(schoolId: string, p: Record<string, any> & { paidOn: string }) {
    const year = p.paidOn.slice(0, 4);
    const counter = this.db.collection('counters').doc(`${schoolId}__receipts__${year}`);
    const ref = this.col.doc();
    const now = new Date();
    const receiptNumber = await this.db.runTransaction(async (tx: any) => {
      const c = await tx.get(counter);
      const next = (c.exists ? c.data()!.value : 0) + 1;
      tx.set(counter, { schoolId, value: next, updatedAt: now });
      const number = `RCP-${year}-${String(next).padStart(4, '0')}`;
      tx.set(ref, { schoolId, ...p, receiptNumber: number, voided: false, createdAt: now });
      return number;
    });
    return this.receipt(schoolId, ref.id).then((r) => ({ ...r, receiptNumber }));
  }

  /** Everything needed to print a receipt, including the balance left after this payment. */
  async receipt(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Payment not found');
    const p = doc.data()!;
    const statement = await this.fees.statement(schoolId, p.studentId, p.term, p.session);
    // Balance straight after this payment: valid payments up to and including this receipt.
    const upTo = statement.payments.filter((x) => !x.voided && (x.paidOn < p.paidOn || (x.paidOn === p.paidOn && x.receiptNumber <= p.receiptNumber)));
    return {
      id: doc.id,
      receiptNumber: p.receiptNumber,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      note: p.note,
      paidOn: p.paidOn,
      term: p.term,
      session: p.session,
      recordedByName: p.recordedByName,
      voided: !!p.voided,
      voidReason: p.voidReason ?? null,
      school: statement.school,
      student: statement.student,
      due: statement.due,
      paidToDate: upTo.reduce((a, x) => a + x.amount, 0),
      balanceAfter: statement.due - upTo.reduce((a, x) => a + x.amount, 0),
    };
  }

  async list(schoolId: string, query: { term?: string; session?: string; studentId?: string }) {
    const ts = await this.fees.resolveTerm(schoolId, query.term, query.session);
    const [paySnap, studentSnap, classSnap] = await Promise.all([
      this.col.where('schoolId', '==', schoolId).where('term', '==', ts.term).where('session', '==', ts.session).get(),
      this.db.collection('students').where('schoolId', '==', schoolId).get(),
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
    ]);
    const students = new Map(studentSnap.docs.map((d) => [d.id, d.data()]));
    const classes = new Map(classSnap.docs.map((d) => [d.id, d.data().name]));
    const payments = paySnap.docs
      .filter((d) => !query.studentId || d.data().studentId === query.studentId)
      .map((d) => {
        const p = d.data();
        const s = students.get(p.studentId);
        return {
          id: d.id, receiptNumber: p.receiptNumber, studentId: p.studentId,
          studentName: s ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() : 'Unknown student',
          admissionNumber: s?.admissionNumber ?? '', className: classes.get(p.classId) ?? null,
          amount: p.amount, method: p.method, reference: p.reference, paidOn: p.paidOn,
          recordedByName: p.recordedByName, voided: !!p.voided, voidReason: p.voidReason ?? null,
        };
      })
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.receiptNumber.localeCompare(a.receiptNumber));
    const valid = payments.filter((p) => !p.voided);
    const byMethod: Record<string, number> = {};
    valid.forEach((p) => (byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount));
    return { ...ts, total: valid.reduce((a, p) => a + p.amount, 0), count: valid.length, byMethod, payments };
  }

  /** Payments are never deleted: a mistaken one is voided with a reason, and stops counting. */
  async void(schoolId: string, user: JwtPayload, id: string, dto: VoidPaymentDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Payment not found');
    if (doc.data()!.voided) throw new BadRequestException('This payment has already been voided.');
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Give a reason for voiding this payment.');
    await doc.ref.update({ voided: true, voidReason: reason, voidedBy: user.sub, voidedByName: await this.userName(user), voidedAt: new Date() });
    return this.receipt(schoolId, id);
  }
}
