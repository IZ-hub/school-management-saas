import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { FirebaseService } from '../../firebase/firebase.service';
import { TermCalendar } from '../../common/term-calendar';
import { countOf } from '../../common/aggregate';
import { appOrigin } from '../../common/origins';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PRICE_PER_STUDENT, invoiceId, loadBillingState, platformPaymentsEnabled } from '../../common/billing';
import { forgetBilling } from '../auth/guards/jwt-auth.guard';
import { PaystackClient } from '../online-payments/paystack.client';

const platformKey = () => process.env.PLATFORM_PAYSTACK_SECRET_KEY ?? '';

@Injectable()
export class BillingService {
  private readonly log = new Logger('Billing');

  constructor(private readonly firebase: FirebaseService, private readonly paystack: PaystackClient) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get invoices() {
    return this.db.collection('billingInvoices');
  }

  private activeStudents(schoolId: string) {
    return countOf(this.db.collection('students').where('schoolId', '==', schoolId).where('status', '==', 'ACTIVE'));
  }

  /** Where the school stands, for the banner every staff member sees. */
  async status(schoolId: string) {
    const st = await loadBillingState(this.db as any, schoolId);
    const students = await this.activeStudents(schoolId);
    return { ...st, students, pricePerStudent: PRICE_PER_STUDENT, estimate: students * PRICE_PER_STUDENT, paymentsEnabled: platformPaymentsEnabled() };
  }

  /** The Billing page: standing, this term's invoice (created when due) and past invoices. */
  async overview(schoolId: string) {
    const status = await this.status(schoolId);
    const invoice = status.status === 'DUE' || status.status === 'READ_ONLY' ? await this.ensureInvoice(schoolId) : await this.currentInvoice(schoolId);
    const history = await this.invoices.where('schoolId', '==', schoolId).get();
    return {
      ...status,
      invoice,
      history: history.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .sort((a, b) => String(b.session + b.term).localeCompare(String(a.session + a.term)))
        .map((i) => ({ id: i.id, term: i.term, session: i.session, students: i.students, amount: i.amount, status: i.status, paidAt: i.paidAt ?? null })),
    };
  }

  private async currentInvoice(schoolId: string) {
    const term = (await TermCalendar.load(this.db as any, schoolId)).current();
    const d = await this.invoices.doc(invoiceId(schoolId, term.term, term.session)).get();
    return d.exists ? { id: d.id, ...(d.data() as any) } : null;
  }

  /** This term's invoice, created from today's active students if it doesn't exist yet. */
  private async ensureInvoice(schoolId: string) {
    const term = (await TermCalendar.load(this.db as any, schoolId)).current();
    const ref = this.invoices.doc(invoiceId(schoolId, term.term, term.session));
    const existing = await ref.get();
    if (existing.exists) return { id: ref.id, ...(existing.data() as any) };
    const students = await this.activeStudents(schoolId);
    const amount = students * PRICE_PER_STUDENT;
    const invoice = {
      schoolId, term: term.term, session: term.session, students, pricePerStudent: PRICE_PER_STUDENT, amount,
      // A school with no students has nothing to pay.
      status: amount === 0 ? 'PAID' : 'OPEN',
      createdAt: new Date(), paidAt: amount === 0 ? new Date() : null,
    };
    await ref.set(invoice);
    if (amount === 0) forgetBilling(schoolId);
    return { id: ref.id, ...invoice };
  }

  /** Starts a Paystack payment (into the SchoolBricks account) for this term's invoice. */
  async pay(schoolId: string, user: JwtPayload, origin?: string) {
    if (!platformPaymentsEnabled()) throw new BadRequestException("Online payment for SchoolBricks isn't set up yet. Please contact SchoolBricks.");
    const invoice = await this.ensureInvoice(schoolId);
    if (invoice.status === 'PAID') throw new BadRequestException('This term is already paid. Thank you!');
    const me = await this.db.collection('users').doc(user.sub).get();
    const reference = `SB-${crypto.randomBytes(9).toString('hex')}`;
    await this.db.collection('billingPayments').doc(reference).set({
      schoolId, invoiceId: invoice.id, amountKobo: invoice.amount * 100, status: 'PENDING', by: user.sub, createdAt: new Date(),
    });
    const { authorizationUrl } = await this.paystack.initialize(platformKey(), {
      email: me.exists ? me.data()!.email : user.email,
      amount: invoice.amount * 100,
      reference,
      callback_url: `${appOrigin(origin)}/billing`,
      metadata: { schoolId, invoiceId: invoice.id, purpose: 'schoolbricks-subscription' },
    });
    return { reference, authorizationUrl };
  }

  async verify(schoolId: string, reference: string) {
    const attempt = await this.db.collection('billingPayments').doc(reference).get();
    if (!attempt.exists || attempt.data()!.schoolId !== schoolId) throw new NotFoundException('Payment not found');
    return this.settle(reference);
  }

  /** Paystack's notice, signed with the SchoolBricks secret key. */
  async webhook(rawBody: Buffer | string, signature: string | undefined, event: any) {
    const key = platformKey();
    if (!key || !signature) return { ok: false };
    const expected = Buffer.from(crypto.createHmac('sha512', key).update(rawBody).digest('hex'));
    const got = Buffer.from(String(signature));
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return { ok: false };
    const reference = event?.data?.reference;
    if (event?.event === 'charge.success' && typeof reference === 'string' && reference.startsWith('SB-')) {
      await this.settle(reference).catch((err) => this.log.warn(`Webhook ${reference}: ${(err as Error).message}`));
    }
    return { ok: true };
  }

  /** Confirms with Paystack and marks the invoice paid, exactly once. */
  private async settle(reference: string) {
    const ref = this.db.collection('billingPayments').doc(reference);
    const a = (await ref.get()).data();
    if (!a) throw new NotFoundException('Payment not found');
    if (a.status === 'SUCCESS') return { status: 'SUCCESS' as const };
    const tx = await this.paystack.verify(platformKey(), reference);
    if (tx.status !== 'success') return { status: tx.status === 'failed' ? ('FAILED' as const) : ('PENDING' as const) };
    if (tx.currency !== 'NGN' || tx.amount !== a.amountKobo || tx.metadata?.invoiceId !== a.invoiceId || tx.metadata?.schoolId !== a.schoolId) {
      await ref.update({ status: 'REVIEW', paystackAmount: tx.amount });
      this.log.warn(`Subscription payment ${reference} needs review.`);
      return { status: 'REVIEW' as const };
    }
    const done = await this.db.runTransaction(async (t: any) => {
      const fresh = await t.get(ref);
      if (fresh.data()!.status === 'SUCCESS') return false;
      t.update(ref, { status: 'SUCCESS', settledAt: new Date() });
      t.update(this.invoices.doc(a.invoiceId), { status: 'PAID', paidAt: new Date(), reference, channel: tx.channel ?? null });
      return true;
    });
    if (done) forgetBilling(a.schoolId);
    return { status: 'SUCCESS' as const };
  }
}

