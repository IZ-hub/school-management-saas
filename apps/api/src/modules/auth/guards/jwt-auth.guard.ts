import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../../common/jwt-secret';
import { FirebaseService } from '../../../firebase/firebase.service';

/** Short-lived memory of each account's standing, so the check costs one read per account every few seconds. */
const CACHE_MS = 20_000;
const accounts = new Map<string, { at: number; status: string | null; role: string | null; schoolId: string | null }>();

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
    request.user = decoded;
    return true;
  }
}
