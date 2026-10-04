import { HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';

const key = (kind: string, value: string) => `${kind}__${crypto.createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 40)}`;

/**
 * Counts attempts per key (an email, an IP address) in Firestore, so the limit holds across server
 * instances. After `max` attempts in `windowMs` the key is locked until the window ends.
 */
export class RateLimiter {
  constructor(private readonly db: FirebaseFirestore.Firestore, private readonly kind: string, private readonly max: number, private readonly windowMs: number) {}

  private ref(value: string) {
    return this.db.collection('rateLimits').doc(key(this.kind, value));
  }

  /** Throws 429 if this key is currently locked. */
  async check(value: string, message: string) {
    const d = (await this.ref(value).get()).data();
    if (d && d.count >= this.max && Date.now() - Number(d.windowStart) < this.windowMs) {
      const minutes = Math.max(1, Math.ceil((this.windowMs - (Date.now() - Number(d.windowStart))) / 60_000));
      throw new HttpException(message.replace('{minutes}', String(minutes)), HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async hit(value: string) {
    const ref = this.ref(value);
    const d = (await ref.get()).data();
    const fresh = !d || Date.now() - Number(d.windowStart) >= this.windowMs;
    await ref.set({ kind: this.kind, count: fresh ? 1 : d!.count + 1, windowStart: fresh ? Date.now() : d!.windowStart, updatedAt: new Date() });
  }

  async clear(value: string) {
    await this.ref(value).delete();
  }
}

/** The caller's IP address. Firebase Hosting puts the real one first in X-Forwarded-For. */
export const clientIp = (req: { headers: Record<string, any>; ip?: string }) =>
  String(req.headers['x-forwarded-for'] ?? req.ip ?? 'unknown').split(',')[0].trim();
