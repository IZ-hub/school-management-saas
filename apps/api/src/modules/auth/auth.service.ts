import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { FirebaseService } from '../../firebase/firebase.service';
import { getJwtSecret } from '../../common/jwt-secret';
import { LoginDto } from './dto/login.dto';
import { RegisterSchoolDto } from './dto/register-school.dto';

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

    const tokenPayload = {
      sub: userDoc.id,
      email: userData.email,
      role: userData.role,
      schoolId: userData.schoolId,
    };

    const accessToken = this.generateAccessToken(tokenPayload);

    // Update last login
    await userDoc.ref.update({ lastLogin: new Date() });

    return {
      data: {
        user: {
          id: userDoc.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          schoolId: userData.schoolId,
        },
        accessToken,
      },
    };
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

    const tokenPayload = {
      sub: userRef.id,
      email: dto.ownerEmail,
      role: 'SCHOOL_OWNER',
      schoolId: schoolRef.id,
    };

    const accessToken = this.generateAccessToken(tokenPayload);

    return {
      data: {
        user: {
          id: userRef.id,
          email: dto.ownerEmail,
          firstName: dto.ownerFirstName,
          lastName: dto.ownerLastName,
          role: 'SCHOOL_OWNER',
          schoolId: schoolRef.id,
        },
        accessToken,
      },
    };
  }
}
