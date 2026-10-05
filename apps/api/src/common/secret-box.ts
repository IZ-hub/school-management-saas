import * as crypto from 'crypto';
import { getJwtSecret } from './jwt-secret';

/**
 * Encrypts small secrets (e.g. a school's Paystack key) before they are stored. The key is derived from the
 * server's JWT secret with a separate label, so stored values are useless without the server's environment.
 * Rotating the JWT secret makes old values unreadable; schools then re-enter their key.
 */
// 'schoolful' is the product's original name. It is part of the key itself, so it must never change,
// or every stored Paystack and SMS key becomes unreadable.
const key = () => Buffer.from(crypto.hkdfSync('sha256', getJwtSecret(), 'schoolful', 'school-secrets-v1', 32));

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

/** Returns null if the value can't be decrypted (tampered, or sealed under another secret). */
export function open(sealed: string): string | null {
  try {
    const [v, iv, tag, data] = sealed.split('.');
    if (v !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
