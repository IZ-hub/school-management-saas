import * as crypto from 'crypto';
import { SCHOOL_TIME_ZONE } from '../../common/school-date';

export type ScanMode = 'AUTO' | 'IN' | 'OUT';
export type ScanAction = 'IN' | 'OUT' | 'ALREADY_IN' | 'ALREADY_OUT';

/** A second scan this soon after clocking in is treated as a repeat, not a departure. */
export const REPEAT_WINDOW_MS = 5 * 60_000;
/** Card codes avoid letters and digits that are easy to confuse (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 10;
/** What a card's QR code holds: a prefix plus the code, and nothing personal. */
export const QR_PREFIX = 'SP1-';

export const newCode = () => Array.from(crypto.randomBytes(CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
/** "SP1-ABCD…", "abcd…" or a code typed with spaces all read the same. */
export const readCode = (raw: string) => raw.trim().toUpperCase().replace(/^SP1-/, '').replace(/[\s-]/g, '');
export const timeAt = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: SCHOOL_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const toDate = (v: any): Date | null => (v ? (v.toDate?.() ?? (v instanceof Date ? v : new Date(v))) : null);
