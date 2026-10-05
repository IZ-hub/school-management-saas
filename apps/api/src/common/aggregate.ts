import { AggregateField } from 'firebase-admin/firestore';
import { Logger } from '@nestjs/common';

const log = new Logger('Queries');

const needsIndex = (err: any) => err?.code === 9 || /FAILED_PRECONDITION|requires an index/i.test(String(err?.message));

/**
 * Firestore can count or add up matching documents without downloading them, billed at one
 * read per 1,000 documents instead of one per document.
 */
export async function countOf(query: FirebaseFirestore.Query): Promise<number> {
  try {
    return (await query.count().get()).data().count;
  } catch (err) {
    // Never let a missing index break a page: count the documents instead.
    if (!needsIndex(err)) throw err;
    log.warn('Index for a count is missing; counting documents instead.');
    return (await query.get()).size;
  }
}

/** Sum aggregates need a composite index that includes the summed field; without one we add up here. */
export async function sumOf(query: FirebaseFirestore.Query, field: string): Promise<number> {
  try {
    const snap = await query.aggregate({ total: AggregateField.sum(field) }).get();
    return Number(snap.data().total ?? 0);
  } catch (err) {
    if (!needsIndex(err)) throw err;
    log.warn(`Index for summing ${field} is missing; adding up documents instead.`);
    return (await query.get()).docs.reduce((a, d) => a + (typeof d.data()[field] === 'number' ? d.data()[field] : 0), 0);
  }
}

/**
 * Runs a date-range query that needs a composite index. While a new index is still building
 * (or if it is missing), Firestore refuses with FAILED_PRECONDITION; then we fall back to the
 * equality-only query and filter the dates here, so the page still works, just with more reads.
 */
export async function inDateRange(
  base: FirebaseFirestore.Query,
  field: string,
  from: string,
  to: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  try {
    return (await base.where(field, '>=', from).where(field, '<=', to).get()).docs;
  } catch (err: any) {
    if (!needsIndex(err)) throw err;
    log.warn(`Index for ${field} range not ready; reading without it.`);
    return (await base.get()).docs.filter((d) => d.data()[field] >= from && d.data()[field] <= to);
  }
}
