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

// Two tabs may renew with the same token at the same moment; allow the second within this window.
const ROTATION_GRACE_MS = 60 * 1000;

const toMillis = (v: any): number => v?.toMillis?.() ?? v?.getTime?.() ?? new Date(v).getTime();
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly firebase: FirebaseService) {
    // Fail at startup rather than on the first login.
    getJwtSecret();
  }

  private get db() {
    return this.firebase.firestore;
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

  async login(dto: LoginDto) {
    let query: FirebaseFirestore.Query = this.db.collection('users').where('email', '==', dto.email);
    if (dto.schoolId) query = query.where('schoolId', '==', dto.schoolId);
    // Fetch two so we can tell when an email is shared across schools.
    const usersSnap = await query.limit(2).get();

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

    const passwordValid = await bcrypt.compare(dto.password, userData.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (userData.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Update last login
    await userDoc.ref.update({ lastLogin: new Date() });

    return this.createSession(userDoc.id, userData);
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
