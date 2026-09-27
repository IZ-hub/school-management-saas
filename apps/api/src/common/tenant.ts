import { NotFoundException } from '@nestjs/common';

/**
 * Loads a document only if it belongs to the given school.
 * A document owned by another school is reported as not found, so callers
 * cannot learn whether an ID exists in someone else's tenant.
 */
export async function getOwnedDoc(
  col: FirebaseFirestore.CollectionReference,
  id: string,
  schoolId: string,
  notFoundMessage: string,
): Promise<FirebaseFirestore.DocumentSnapshot> {
  const doc = await col.doc(id).get();
  if (!doc.exists || doc.data()?.schoolId !== schoolId) {
    throw new NotFoundException(notFoundMessage);
  }
  return doc;
}
