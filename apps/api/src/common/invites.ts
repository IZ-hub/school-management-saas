import * as crypto from 'crypto';

export const INVITE_DAYS = 7;
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * Creates a one-time setup link code ("<id>.<secret>") for an invited user. Only a hash of the
 * secret is stored, and any earlier unused link for the same user stops working.
 */
export async function createInvite(db: FirebaseFirestore.Firestore, schoolId: string, userId: string, createdBy: string) {
  const old = await db.collection('invites').where('userId', '==', userId).get();
  const now = new Date();
  await Promise.all(old.docs.filter((d) => !d.data().usedAt).map((d) => d.ref.update({ usedAt: now, replaced: true })));
  const secret = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  const ref = await db.collection('invites').add({ schoolId, userId, hash: sha256(secret), createdBy, createdAt: now, expiresAt, usedAt: null });
  return { code: `${ref.id}.${secret}`, expiresAt };
}

/** Signs a user out everywhere by deleting their refresh tokens. */
export async function revokeSessions(db: FirebaseFirestore.Firestore, userId: string) {
  const tokens = await db.collection('refreshTokens').where('userId', '==', userId).get();
  await Promise.all(tokens.docs.map((t) => t.ref.delete()));
}
