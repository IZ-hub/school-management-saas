import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { FirebaseService } from '../../firebase/firebase.service';
import { open, seal } from '../../common/secret-box';
import { schoolToday } from '../../common/school-date';
import { TermCalendar } from '../../common/term-calendar';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { FeesService } from '../fees/fees.service';
import { PaymentsService } from '../payments/payments.service';
import { PaystackClient, PaystackTransaction } from './paystack.client';

/** Where Paystack may send parents back to after paying. */
const RETURN_ORIGINS = [
  'https://school-management-1f070.web.app',
  'https://school-management-1f070.firebaseapp.com',
  'http://localhost:5173',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : []),
];
const API_BASE = 'https://school-management-1f070.web.app/api/v1';

@Injectable()
export class OnlinePaymentsService {
  private readonly log = new Logger('OnlinePayments');

  constructor(
    private readonly firebase: FirebaseService,
    private readonly paystack: PaystackClient,
    private readonly fees: FeesService,
    private readonly payments: PaymentsService,
  ) {}

  private get db() {
    return this.firebase.firestore;
  }

  /** Secrets live in their own collection so no ordinary read of the school ever includes them. */
  private secrets(schoolId: string) {
    return this.db.collection('schoolSecrets').doc(schoolId);
  }

  private get attempts() {
    return this.db.collection('onlinePayments');
  }

  private async secretKey(schoolId: string): Promise<string | null> {
    const doc = await this.secrets(schoolId).get();
    const sealed = doc.exists ? doc.data()!.paystackSecretKey : null;
    return sealed ? open(sealed) : null;
  }

  // ----- School admin -----

  async settings(schoolId: string) {
    const doc = await this.secrets(schoolId).get();
    const d = doc.exists ? doc.data()! : null;
    const readable = !!d?.paystackSecretKey && open(d.paystackSecretKey) !== null;
    return {
      enabled: readable,
      needsNewKey: !!d?.paystackSecretKey && !readable,
      mode: readable ? d!.paystackMode : null,
      keyHint: readable ? d!.paystackKeyHint : null,
      webhookUrl: `${API_BASE}/paystack/webhook/${schoolId}`,
    };
  }

  async saveKey(schoolId: string, userId: string, secretKey: string) {
    await this.paystack.checkKey(secretKey);
    // Other settings (e.g. the SMS key) share this document, so keep them.
    const existing = (await this.secrets(schoolId).get()).data() ?? {};
    await this.secrets(schoolId).set({
      ...existing,
      schoolId,
      paystackSecretKey: seal(secretKey),
      paystackMode: secretKey.startsWith('sk_live_') ? 'live' : 'test',
      paystackKeyHint: `…${secretKey.slice(-4)}`,
      updatedBy: userId,
      updatedAt: new Date(),
    });
    return this.settings(schoolId);
  }

  async removeKey(schoolId: string) {
    const ref = this.secrets(schoolId);
    const d = (await ref.get()).data();
    if (d) {
      const { paystackSecretKey: _k, paystackMode: _m, paystackKeyHint: _h, ...rest } = d;
      await ref.set(rest);
    }
    return this.settings(schoolId);
  }

  /** Online payment attempts for the school, newest first, for reconciliation. */
  async list(schoolId: string) {
    const snap = await this.attempts.where('schoolId', '==', schoolId).get();
    return snap.docs
      .map((d) => {
        const a = d.data();
        return { reference: d.id, studentId: a.studentId, studentName: a.studentName, amount: a.amount, status: a.status, receiptNumber: a.receiptNumber ?? null, payerName: a.payerName, createdAt: a.createdAt, settledAt: a.settledAt ?? null };
      })
      .sort((a, b) => (b.createdAt?.valueOf?.() ?? 0) - (a.createdAt?.valueOf?.() ?? 0));
  }

  // ----- Parents -----

  async enabledFor(schoolId: string) {
    return (await this.secretKey(schoolId)) !== null;
  }

  private async parentChild(user: JwtPayload, studentId: string) {
    const me = await this.db.collection('users').doc(user.sub).get();
    if (!me.exists || me.data()!.role !== 'PARENT' || me.data()!.status !== 'ACTIVE' || me.data()!.schoolId !== user.schoolId) throw new ForbiddenException('Your account is not active.');
    if (!(me.data()!.childIds ?? []).includes(studentId)) throw new NotFoundException('Student not found');
    const child = await this.db.collection('students').doc(studentId).get();
    if (!child.exists || child.data()!.schoolId !== user.schoolId || child.data()!.status === 'INACTIVE') throw new NotFoundException('Student not found');
    return { me: me.data()!, child: child.data()! };
  }

  /** Starts a Paystack payment for a child's fees this term and returns the page to send the parent to. */
  async start(user: JwtPayload, studentId: string, amount: number, origin?: string) {
    const { me, child } = await this.parentChild(user, studentId);
    const key = await this.secretKey(user.schoolId);
    if (!key) throw new BadRequestException("Your school hasn't set up online payments yet.");
    const ts = (await TermCalendar.load(this.db as any, user.schoolId)).current();
    const statement = await this.fees.statement(user.schoolId, studentId, ts.term, ts.session);
    if (!statement.feesSet) throw new BadRequestException("Fees for this term haven't been set yet.");
    if (statement.balance <= 0) throw new BadRequestException(`${child.firstName}'s fees for this term are fully paid.`);
    if (amount > statement.balance) throw new BadRequestException(`The balance is ₦${statement.balance.toLocaleString('en-NG')}.`);

    const reference = `SF-${crypto.randomBytes(9).toString('hex')}`;
    const returnTo = RETURN_ORIGINS.includes(origin ?? '') ? origin! : RETURN_ORIGINS[0];
    const studentName = `${child.firstName ?? ''} ${child.lastName ?? ''}`.trim();
    const payerName = `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() || me.email;
    await this.attempts.doc(reference).set({
      schoolId: user.schoolId, studentId, studentName, term: ts.term, session: ts.session,
      amount, amountKobo: amount * 100, parentUserId: user.sub, payerName, email: me.email,
      status: 'PENDING', createdAt: new Date(),
    });
    const { authorizationUrl } = await this.paystack.initialize(key, {
      email: me.email,
      amount: amount * 100,
      reference,
      callback_url: `${returnTo}/parent?child=${encodeURIComponent(studentId)}`,
      metadata: { schoolId: user.schoolId, studentId, term: ts.term, session: ts.session, custom_fields: [{ display_name: 'Student', variable_name: 'student', value: studentName }] },
    });
    return { reference, authorizationUrl };
  }

  /** Called when the parent comes back from Paystack. */
  async verifyForParent(user: JwtPayload, reference: string) {
    const attempt = await this.attempts.doc(reference).get();
    if (!attempt.exists || attempt.data()!.schoolId !== user.schoolId || attempt.data()!.parentUserId !== user.sub) throw new NotFoundException('Payment not found');
    return this.settle(user.schoolId, reference);
  }

  /** Paystack's server-to-server notice. Only trusted if signed with the school's own secret key. */
  async webhook(schoolId: string, rawBody: Buffer | string, signature: string | undefined, event: any) {
    const key = await this.secretKey(schoolId);
    if (!key || !signature) return { ok: false };
    const expected = crypto.createHmac('sha512', key).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false };
    if (event?.event !== 'charge.success' || !event?.data?.reference) return { ok: true };
    try {
      await this.settle(schoolId, String(event.data.reference));
    } catch (err) {
      this.log.warn(`Webhook for ${event.data.reference}: ${(err as Error).message}`);
    }
    return { ok: true };
  }

  /**
   * Confirms a payment with Paystack and records it once. The attempt is claimed inside a transaction,
   * so the parent's return and the webhook arriving together can't both record it.
   */
  private async settle(schoolId: string, reference: string) {
    const ref = this.attempts.doc(reference);
    const current = await ref.get();
    if (!current.exists || current.data()!.schoolId !== schoolId) throw new NotFoundException('Payment not found');
    if (current.data()!.status === 'SUCCESS') return this.result(current.data()!);
    if (current.data()!.status === 'FAILED') return this.result(current.data()!);

    const key = await this.secretKey(schoolId);
    if (!key) throw new BadRequestException('Online payments are switched off for this school.');
    const tx: PaystackTransaction = await this.paystack.verify(key, reference);
    const a = current.data()!;

    if (tx.status !== 'success') {
      if (['failed', 'abandoned', 'reversed'].includes(tx.status)) await ref.update({ status: 'FAILED', paystackStatus: tx.status, updatedAt: new Date() });
      return { status: tx.status === 'failed' || tx.status === 'reversed' ? 'FAILED' : 'PENDING', amount: a.amount, receiptNumber: null, paymentId: null };
    }
    if (tx.currency !== 'NGN' || tx.amount !== a.amountKobo || tx.metadata?.schoolId !== schoolId || tx.metadata?.studentId !== a.studentId) {
      await ref.update({ status: 'REVIEW', paystackStatus: tx.status, paystackAmount: tx.amount, updatedAt: new Date() });
      this.log.warn(`Payment ${reference} needs review: amount or details don't match.`);
      return { status: 'REVIEW', amount: a.amount, receiptNumber: null, paymentId: null };
    }

    const claimed = await this.db.runTransaction(async (t: any) => {
      const fresh = await t.get(ref);
      if (fresh.data()!.status !== 'PENDING' && fresh.data()!.status !== 'FAILED') return false;
      t.update(ref, { status: 'SETTLING', updatedAt: new Date() });
      return true;
    });
    if (!claimed) return this.result((await ref.get()).data()!);

    try {
      const paidOn = tx.paidAt ? tx.paidAt.slice(0, 10) : schoolToday();
      const receipt = await this.payments.recordOnline(schoolId, {
        studentId: a.studentId, term: a.term, session: a.session, amount: a.amount,
        paidOn: paidOn > schoolToday() ? schoolToday() : paidOn, reference, payerName: a.payerName,
      });
      const done = { status: 'SUCCESS', paymentId: receipt.id, receiptNumber: receipt.receiptNumber, channel: tx.channel, settledAt: new Date(), updatedAt: new Date() };
      await ref.update(done);
      return { status: 'SUCCESS', amount: a.amount, receiptNumber: receipt.receiptNumber, paymentId: receipt.id };
    } catch (err) {
      await ref.update({ status: 'PENDING', updatedAt: new Date() });
      throw err;
    }
  }

  private result(a: any) {
    return { status: a.status === 'SETTLING' ? 'PENDING' : a.status, amount: a.amount, receiptNumber: a.receiptNumber ?? null, paymentId: a.paymentId ?? null };
  }
}
