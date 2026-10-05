import { AggregateField } from 'firebase-admin/firestore';
import { Logger } from '@nestjs/common';

/**
 * Firestore can count or add up matching documents without downloading them, billed at one
 * read per 1,000 documents instead of one per document.
 */
export async function countOf(query: FirebaseFirestore.Query): Promise<number> {
  return (await query.count().get()).data().count;
}

export async function sumOf(query: FirebaseFirestore.Query, field: string): Promise<number> {
  const snap = await query.aggregate({ total: AggregateField.sum(field) }).get();
  return Number(snap.data().total ?? 0);
}

const log = new Logger('Queries');

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
    if (err?.code !== 9 && !/FAILED_PRECONDITION|requires an index/i.test(String(err?.message))) throw err;
    log.warn(`Index for ${field} range not ready; reading without it.`);
    return (await base.get()).docs.filter((d) => d.data()[field] >= from && d.data()[field] <= to);
  }
}
