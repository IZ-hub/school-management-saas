import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { FirebaseService } from '../../firebase/firebase.service';
import { getJwtSecret } from '../../common/jwt-secret';
import { LoginDto } from './dto/login.dto';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { SESSION_DAYS } from './session-cookie';
import { RateLimiter } from '../../common/rate-limit';
import { createInvite, revokeSessions } from '../../common/invites';
import { mailEnabled, sendMail } from '../../common/mailer';
import { appOrigin } from '../../common/origins';
import { forgetAccount } from './guards/jwt-auth.guard';

// Two tabs may renew with the same token at the same moment; allow the second within this window.
const ROTATION_GRACE_MS = 60 * 1000;

const toMillis = (v: any): number => v?.toMillis?.() ?? v?.getTime?.() ?? new Date(v).getTime();
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Injectable()
export class AuthService {
  constructor(private readonly firebase: FirebaseService) {
    // Fail at startup rather than on the first login.
    getJwtSecret();
  }

  private get db() {
    return this.firebase.firestore;
  }

  /** Five wrong passwords for an email, or thirty from one address, lock sign-in for 15 minutes. */
  private get emailFailures() {
    return new RateLimiter(this.db as any, 'login-email', 5, 15 * 60_000);
  }

  private get ipFailures() {
    return new RateLimiter(this.db as any, 'login-ip', 30, 15 * 60_000);
  }

  private generateAccessToken(payload: Record<string, any>): string {
    return jwt.sign(payload, getJwtSecret(), {
      expiresIn: 900, // 15 minutes in seconds
    } as jwt.SignOptions);
  }

  private get refreshTokens() {
    return this.db.collection('refreshTokens');
  }

  /** Stores only a hash of the secret; the browser holds "<id>.<secret>" in an httpOnly cookie. */
  private async createRefreshToken(userId: string, schoolId: string): Promise<string> {
    const secret = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    const ref = await this.refreshTokens.add({
      userId,
      schoolId,
      hash: sha256(secret),
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000),
      rotatedAt: null,
    });
    return `${ref.id}.${secret}`;
  }

  /** Short-lived access token plus a long-lived refresh token for this user. */
  private async createSession(userId: string, u: Record<string, any>) {
    const user = { id: userId, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, schoolId: u.schoolId };
    const accessToken = this.generateAccessToken({ sub: userId, email: u.email, role: u.role, schoolId: u.schoolId });
    const refreshToken = await this.createRefreshToken(userId, u.schoolId);
    return { user, accessToken, refreshToken };
  }

  /** Finds the stored refresh token for a cookie value, or null if it doesn't match. */
  private async findRefreshToken(cookieValue?: string) {
    const [id, secret] = (cookieValue ?? '').split('.');
    if (!id || !secret || id.includes('/')) return null;
    const doc = await this.refreshTokens.doc(id).get();
    if (!doc.exists) return null;
    const expected = Buffer.from(doc.data()!.hash, 'hex');
    const actual = Buffer.from(sha256(secret), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    return doc;
  }

  /** Swaps a valid refresh token for a new session, retiring the old token. */
  async refresh(cookieValue?: string) {
    const expired = () => new UnauthorizedException('Your session has expired. Please sign in again.');
    const doc = await this.findRefreshToken(cookieValue);
    if (!doc) throw expired();
    const t = doc.data()!;
    const now = Date.now();
    if (toMillis(t.expiresAt) <= now) {
      await doc.ref.delete();
      throw expired();
    }
    if (t.rotatedAt && now - toMillis(t.rotatedAt) > ROTATION_GRACE_MS) {
      await doc.ref.delete();
      throw expired();
    }
    const userDoc = await this.db.collection('users').doc(t.userId).get();
    if (!userDoc.exists || userDoc.data()!.status !== 'ACTIVE') {
      await doc.ref.delete();
      throw expired();
    }
    if (!t.rotatedAt) await doc.ref.update({ rotatedAt: new Date() });
    return this.createSession(userDoc.id, userDoc.data()!);
  }

  /** Revokes the refresh token behind this cookie, if any. */
  async logout(cookieValue?: string) {
    const doc = await this.findRefreshToken(cookieValue);
    if (doc) await doc.ref.delete();
  }

  async login(dto: LoginDto, ip = 'unknown') {
    const locked = 'Too many wrong attempts. Wait {minutes} minutes, or use "Forgot password?".';
    await this.emailFailures.check(dto.email, locked);
    await this.ipFailures.check(ip, 'Too many sign-in attempts from this network. Try again in {minutes} minutes.');
    try {
      const session = await this.attemptLogin(dto);
      await this.emailFailures.clear(dto.email);
      return session;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        await Promise.all([this.emailFailures.hit(dto.email), this.ipFailures.hit(ip)]);
      }
      throw err;
    }
  }

  private async attemptLogin(dto: LoginDto) {
    const byEmail = (email: string) => {
      let query: FirebaseFirestore.Query = this.db.collection('users').where('email', '==', email);
      if (dto.schoolId) query = query.where('schoolId', '==', dto.schoolId);
      // Fetch two so we can tell when an email is shared across schools.
      return query.limit(2).get();
    };
    let usersSnap = await byEmail(dto.email);
    // Parent accounts are stored in lowercase, so "Ada@Mail.com" still finds "ada@mail.com".
    if (usersSnap.empty && dto.email !== dto.email.toLowerCase()) usersSnap = await byEmail(dto.email.toLowerCase());

    if (usersSnap.empty) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (usersSnap.size > 1) {
      throw new BadRequestException({
        code: 'SCHOOL_ID_REQUIRED',
        message: 'This email is registered at more than one school. Enter your School ID to continue.',
      });
    }

    const userDoc = usersSnap.docs[0];
    const userData = userDoc.data();

    // Invited parents have no password until they open their setup link.
    const passwordValid = !!userData.password && (await bcrypt.compare(dto.password, userData.password));
    if (!passwordValid) {
      if (userData.status === 'INVITED') {
        throw new UnauthorizedException('Finish setting up your account with the link your school sent you.');
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (userData.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Update last login
    await userDoc.ref.update({ lastLogin: new Date() });

    return this.createSession(userDoc.id, userData);
  }

  /** Finds a usable invite for a "<id>.<secret>" code, or throws. */
  private async findInvite(code: string) {
    const invalid = () => new BadRequestException('This link is not valid or has expired. Ask your school for a new one.');
    const [id, secret] = (code ?? '').split('.');
    if (!id || !secret || id.includes('/')) throw invalid();
    const doc = await this.db.collection('invites').doc(id).get();
    if (!doc.exists) throw invalid();
    const inv = doc.data()!;
    const expected = Buffer.from(inv.hash, 'hex');
    const actual = Buffer.from(sha256(secret), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw invalid();
    if (inv.usedAt || toMillis(inv.expiresAt) <= Date.now()) throw invalid();
    const user = await this.db.collection('users').doc(inv.userId).get();
    // Setup links are for accounts not yet set up; reset links for active accounts.
    const purpose: 'SETUP' | 'RESET' = inv.purpose === 'RESET' ? 'RESET' : 'SETUP';
    if (!user.exists || user.data()!.status !== (purpose === 'RESET' ? 'ACTIVE' : 'INVITED')) throw invalid();
    return { doc, inv, user, purpose };
  }

  /** What the setup page shows before the parent chooses a password. */
  async getInvite(code: string) {
    const { inv, user, purpose } = await this.findInvite(code);
    const u = user.data()!;
    const [school, students] = await Promise.all([
      this.db.collection('schools').doc(inv.schoolId).get(),
      Promise.all((u.childIds ?? []).map((id: string) => this.db.collection('students').doc(id).get())),
    ]);
    return {
      email: u.email,
      firstName: u.firstName,
      role: u.role,
      purpose,
      schoolName: school.exists ? school.data()!.name : '',
      children: students.filter((d: any) => d.exists && d.data().schoolId === inv.schoolId).map((d: any) => d.data().firstName),
    };
  }

  /** Sets the invited parent's password, activates the account and signs them in. */
  async acceptInvite(code: string, password: string) {
    if (typeof password !== 'string' || password.length < 8) throw new BadRequestException('Use at least 8 characters for your password.');
    const { doc, user, purpose } = await this.findInvite(code);
    const now = new Date();
    // A reset signs the account out everywhere else before signing in here.
    if (purpose === 'RESET') await revokeSessions(this.db as any, user.id);
    await user.ref.update({ password: await bcrypt.hash(password, 10), status: 'ACTIVE', lastLogin: now, updatedAt: now });
    await doc.ref.update({ usedAt: now });
    await this.emailFailures.clear(user.data()!.email);
    forgetAccount(user.id);
    return this.createSession(user.id, { ...user.data()!, status: 'ACTIVE' });
  }

  /**
   * Emails a one-hour reset link. Always answers the same way, so it can't be used to discover
   * which emails have accounts; repeated requests are limited per email and per address.
   */
  async forgotPassword(email: string, origin?: string, ip = 'unknown') {
    const perEmail = new RateLimiter(this.db as any, 'forgot-email', 3, 60 * 60_000);
    const perIp = new RateLimiter(this.db as any, 'forgot-ip', 10, 60 * 60_000);
    const done = { sent: true, emailEnabled: mailEnabled() };
    try {
      await perEmail.check(email, '');
      await perIp.check(ip, '');
    } catch {
      return done;
    }
    await Promise.all([perEmail.hit(email), perIp.hit(ip)]);

    const lower = email.trim().toLowerCase();
    const found = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const e of new Set([email.trim(), lower])) {
      (await this.db.collection('users').where('email', '==', e).limit(5).get()).docs.forEach((d) => found.set(d.id, d));
    }
    const accounts = [...found.values()].filter((d) => d.data().status === 'ACTIVE').slice(0, 3);
    if (accounts.length === 0) return done;

    const base = appOrigin(origin);
    const links: { school: string; url: string }[] = [];
    for (const a of accounts) {
      const { code } = await createInvite(this.db as any, a.data().schoolId, a.id, 'self', 'RESET', 1);
      const school = await this.db.collection('schools').doc(a.data().schoolId).get();
      links.push({ school: school.exists ? school.data()!.name : 'your school', url: `${base}/reset#${code}` });
    }
    const name = accounts[0].data().firstName || 'there';
    const lines = links.map((l) => (links.length > 1 ? `${l.school}: ${l.url}` : l.url));
    await sendMail(
      accounts[0].data().email,
      'Reset your Schoolful LMS password',
      `Hello ${name},\n\nUse this link to choose a new password. It works once and expires in 1 hour:\n\n${lines.join('\n')}\n\nIf you didn't ask for this, you can ignore this email; your password won't change.\n\nSchoolful LMS`,
      `<p>Hello ${escapeHtml(name)},</p><p>Use this link to choose a new password. It works once and expires in 1 hour:</p>${links
        .map((l) => `<p>${links.length > 1 ? `<b>${escapeHtml(l.school)}</b><br>` : ''}<a href="${l.url}">Reset my password</a></p>`)
        .join('')}<p>If you didn't ask for this, you can ignore this email; your password won't change.</p><p>Schoolful LMS</p>`,
    );
    return done;
  }

  async registerSchool(dto: RegisterSchoolDto) {
    // Check if school email already exists
    const existingSchool = await this.db
      .collection('schools')
      .where('email', '==', dto.schoolEmail)
      .limit(1)
      .get();

    if (!existingSchool.empty) {
      throw new BadRequestException('A school with this email already exists');
    }

    // Check if owner email already exists
    const existingUser = await this.db
      .collection('users')
      .where('email', '==', dto.ownerEmail)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      throw new BadRequestException('A user with this email already exists');
    }

    const now = new Date();
    const slug = dto.schoolName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Create school
    const schoolRef = await this.db.collection('schools').add({
      name: dto.schoolName,
      slug,
      domain: null,
      logo: null,
      address: dto.address || '',
      city: dto.city || null,
      state: dto.state || null,
      country: dto.country || null,
      schoolType: dto.schoolType || null,
      phone: dto.phone || '',
      email: dto.schoolEmail,
      website: null,
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
      subscriptionEnd: null,
      settings: {},
      createdAt: now,
      updatedAt: now,
    });

    // Hash password and create owner user
    const hashedPassword = await bcrypt.hash(dto.ownerPassword, 10);

    const userRef = await this.db.collection('users').add({
      schoolId: schoolRef.id,
      email: dto.ownerEmail,
      password: hashedPassword,
      firstName: dto.ownerFirstName,
      lastName: dto.ownerLastName,
      phone: null,
      avatar: null,
      role: 'SCHOOL_OWNER',
      status: 'ACTIVE',
      lastLogin: now,
      emailVerified: false,
      mfaEnabled: false,
      mfaSecret: null,
      permissions: [],
      createdAt: now,
      updatedAt: now,
    });

    return this.createSession(userRef.id, {
      email: dto.ownerEmail,
      firstName: dto.ownerFirstName,
      lastName: dto.ownerLastName,
      role: 'SCHOOL_OWNER',
      schoolId: schoolRef.id,
    });
  }
}
