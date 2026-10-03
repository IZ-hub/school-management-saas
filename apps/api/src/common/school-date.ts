/** Schools run on Lagos time (WAT), so "today" must not follow the server's UTC clock. */
export const SCHOOL_TIME_ZONE = 'Africa/Lagos';

/** Today's date at the school, as YYYY-MM-DD. */
export function schoolToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const TERMS = ['FIRST', 'SECOND', 'THIRD'] as const;
export type Term = (typeof TERMS)[number];

/** The school term and session for a date: First Term Sep–Dec, Second Jan–Apr, Third May–Aug. */
export function currentTermSession(today = schoolToday()): { term: Term; session: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (m >= 9) return { term: 'FIRST', session: `${y}/${y + 1}` };
  return { term: m <= 4 ? 'SECOND' : 'THIRD', session: `${y - 1}/${y}` };
}
