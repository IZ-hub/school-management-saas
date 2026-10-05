import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { loadBillingState } from '../../../common/billing';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../../common/jwt-secret';
import { FirebaseService } from '../../../firebase/firebase.service';

/** Short-lived memory of each account's standing, so the check costs one read per account every few seconds. */
const CACHE_MS = 20_000;
const accounts = new Map<string, { at: number; status: string | null; role: string | null; schoolId: string | null }>();

/** Each school's billing standing, refreshed every minute; only change requests consult it. */
const BILLING_CACHE_MS = 60_000;
const billing = new Map<string, { at: number; readOnly: boolean }>();

/** Forget a school's cached billing standing, e.g. right after it pays. */
export function forgetBilling(schoolId: string) {
  billing.delete(schoolId);
}

/** Paying, signing in and parents paying school fees always work, even when a school is read-only. */
const ALWAYS_ALLOWED = [/\/billing(\/|$)/, /\/auth\//, /\/parent\/children\/[^/]+\/pay$/, /\/parent\/payments\/verify$/];

/** Drops an account from the cache, e.g. right after it is switched off or its role changes. */
export function forgetAccount(userId: string) {
  accounts.delete(userId);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], getJwtSecret());
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // A token stays valid for 15 minutes, so also check the account itself: a switched-off
    // account, or one whose role or school changed, is refused straight away.
    let a = accounts.get(decoded.sub);
    if (!a || Date.now() - a.at > CACHE_MS) {
      const doc = await this.firebase.firestore.collection('users').doc(decoded.sub).get();
      a = doc.exists
        ? { at: Date.now(), status: doc.data()!.status ?? null, role: doc.data()!.role ?? null, schoolId: doc.data()!.schoolId ?? null }
        : { at: Date.now(), status: null, role: null, schoolId: null };
      accounts.set(decoded.sub, a);
    }
    // Accounts are never deleted, so a missing record only happens for tokens minted outside sign-in (tests).
    if (a.status !== null && (a.status !== 'ACTIVE' || a.role !== decoded.role || a.schoolId !== decoded.schoolId)) {
      throw new UnauthorizedException('Your account has changed. Please sign in again.');
    }
    // A school whose subscription is overdue past its grace period can still view everything but not change it.
    const method = String(request.method ?? 'GET').toUpperCase();
    const path = String(request.originalUrl ?? request.url ?? '').split('?')[0];
    if (method !== 'GET' && method !== 'HEAD' && decoded.schoolId && !ALWAYS_ALLOWED.some((r) => r.test(path))) {
      let b = billing.get(decoded.schoolId);
      if (!b || Date.now() - b.at > BILLING_CACHE_MS) {
        const st = await loadBillingState(this.firebase.firestore as any, decoded.schoolId);
        b = { at: Date.now(), readOnly: st.enforced && st.status === 'READ_ONLY' };
        billing.set(decoded.schoolId, b);
      }
      if (b.readOnly) {
        throw new HttpException(
          decoded.role === 'PARENT'
            ? "The school's SchoolBricks subscription is overdue, so changes are paused. You can still view everything."
            : 'Your SchoolBricks subscription is overdue, so your school is read-only. An admin can pay on the Billing page to continue.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }
    request.user = decoded;
    return true;
  }
}
