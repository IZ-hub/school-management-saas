import { TermCalendar } from './term-calendar';
import { schoolToday } from './school-date';

/** SchoolBricks pricing: per active student, per term. */
export const PRICE_PER_STUDENT = 1500;
export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
/** Schools that existed before billing began get a full trial counted from this date. */
export const BILLING_LAUNCH = '2026-10-05';

export type BillingStatus = 'TRIAL' | 'ACTIVE' | 'DUE' | 'READ_ONLY';

const addDays = (iso: string, days: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const isoOf = (v: any): string | null => {
  const ms = v?.toMillis?.() ?? v?.getTime?.() ?? (v ? new Date(v).getTime() : NaN);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
};

/** The platform's own Paystack key (in the API's .env). Without it nobody can pay, so nothing is locked. */
export const platformPaymentsEnabled = () => !!process.env.PLATFORM_PAYSTACK_SECRET_KEY;

export interface BillingState {
  status: BillingStatus;
  trialEndsOn: string;
  term: { term: string; session: string };
  /** When this term's invoice is due (end of trial, or the start of the term). */
  dueOn: string | null;
  /** The day the school becomes read-only if still unpaid. */
  readOnlyFrom: string | null;
  paid: boolean;
  /** Read-only is only enforced when schools can actually pay. */
  enforced: boolean;
}

/**
 * Works out where a school stands, from its record and whether this term's invoice is paid.
 * Pure: no writes, so the sign-in check can call it cheaply on every change request.
 */
export function billingState(school: Record<string, any>, calendar: TermCalendar, paidThisTerm: boolean, today = schoolToday()): BillingState {
  const created = isoOf(school.createdAt) ?? BILLING_LAUNCH;
  const trialEndsOn = school.billing?.trialEndsOn ?? addDays(created > BILLING_LAUNCH ? created : BILLING_LAUNCH, TRIAL_DAYS);
  const term = calendar.current(today);
  const enforced = platformPaymentsEnabled();
  if (today < trialEndsOn) return { status: 'TRIAL', trialEndsOn, term, dueOn: trialEndsOn, readOnlyFrom: addDays(trialEndsOn, GRACE_DAYS), paid: false, enforced };
  if (paidThisTerm) return { status: 'ACTIVE', trialEndsOn, term, dueOn: null, readOnlyFrom: null, paid: true, enforced };
  const termStart = calendar.range(term.term, term.session).from;
  const dueOn = termStart > trialEndsOn ? termStart : trialEndsOn;
  const readOnlyFrom = addDays(dueOn, GRACE_DAYS);
  return { status: today >= readOnlyFrom ? 'READ_ONLY' : 'DUE', trialEndsOn, term, dueOn, readOnlyFrom, paid: false, enforced };
}

export const invoiceId = (schoolId: string, term: string, session: string) => `${schoolId}__${session.replace('/', '-')}__${term}`;

/** Loads what billingState needs for one school. */
export async function loadBillingState(db: FirebaseFirestore.Firestore, schoolId: string, today = schoolToday()) {
  const [school, calendar] = await Promise.all([db.collection('schools').doc(schoolId).get(), TermCalendar.load(db, schoolId)]);
  const term = calendar.current(today);
  const invoice = await db.collection('billingInvoices').doc(invoiceId(schoolId, term.term, term.session)).get();
  return billingState(school.data() ?? {}, calendar, invoice.exists && invoice.data()!.status === 'PAID', today);
}
