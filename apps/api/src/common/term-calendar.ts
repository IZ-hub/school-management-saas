import { currentTermSession, fixedTermRange, schoolToday, Term, TERMS } from './school-date';

export interface TermDates { session: string; term: Term; start: string; end: string }

const order = (session: string, term: string) => `${session.slice(0, 4)}-${TERMS.indexOf(term as Term)}`;

/**
 * The school's term calendar: its own term dates from School settings where set, otherwise the
 * usual months. Holidays count as part of the term just ended until the next term begins.
 */
export class TermCalendar {
  constructor(private readonly terms: TermDates[]) {}

  static async load(db: FirebaseFirestore.Firestore, schoolId: string) {
    const doc = await db.collection('schools').doc(schoolId).get();
    return new TermCalendar(doc.exists ? (doc.data()!.termDates ?? []) : []);
  }

  current(today = schoolToday()): { term: Term; session: string } {
    const fixed = currentTermSession(today);
    const started = this.terms.filter((t) => t.start <= today).sort((a, b) => b.start.localeCompare(a.start))[0];
    if (!started) return fixed;
    if (today <= started.end) return { term: started.term, session: started.session };
    // On holiday: stay on the term just ended unless the usual calendar has clearly moved on.
    return order(fixed.session, fixed.term) > order(started.session, started.term) && !this.terms.some((t) => t.session === fixed.session && t.term === fixed.term)
      ? fixed
      : { term: started.term, session: started.session };
  }

  range(term: string, session: string): { from: string; to: string } {
    const t = this.terms.find((x) => x.term === term && x.session === session);
    return t ? { from: t.start, to: t.end } : fixedTermRange(term, session);
  }
}
