import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { createInvite, revokeSessions } from '../../common/invites';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ChangeRoleDto, InviteStaffDto, LinkTeacherDto } from './dto/staff.dto';

const LEADERS = ['PRINCIPAL', 'VICE_PRINCIPAL'];
const OWNERS = ['SCHOOL_OWNER', 'SUPER_ADMIN'];
const toMillis = (v: any): number | null => (v ? v?.toMillis?.() ?? v?.getTime?.() ?? new Date(v).getTime() : null);

@Injectable()
export class StaffService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get users() {
    return this.db.collection('users');
  }

  /** Only the owner can make principals; principals can add teachers and accountants. */
  private checkCanGrant(user: JwtPayload, role: string) {
    if (LEADERS.includes(role) && !OWNERS.includes(user.role)) {
      throw new ForbiddenException('Only the school owner can give someone a principal role.');
    }
  }

  /** A staff account the caller may change: not themselves, not the owner, and not a leader unless they are the owner. */
  private async manageable(schoolId: string, user: JwtPayload, userId: string) {
    const doc = await getOwnedDoc(this.users, userId, schoolId, 'Staff member not found');
    const u = doc.data()!;
    if (u.role === 'PARENT') throw new NotFoundException('Staff member not found');
    if (doc.id === user.sub) throw new BadRequestException("You can't change your own account here.");
    if (OWNERS.includes(u.role)) throw new ForbiddenException("The school owner's account can't be changed.");
    if (LEADERS.includes(u.role) && !OWNERS.includes(user.role)) throw new ForbiddenException('Only the school owner can change a principal’s account.');
    return doc;
  }

  async list(schoolId: string) {
    const [snap, teacherSnap, inviteSnap] = await Promise.all([
      this.users.where('schoolId', '==', schoolId).get(),
      this.db.collection('teachers').where('schoolId', '==', schoolId).get(),
      this.db.collection('invites').where('schoolId', '==', schoolId).get(),
    ]);
    const teachers = new Map(teacherSnap.docs.map((d) => [d.id, `${d.data().firstName ?? ''} ${d.data().lastName ?? ''}`.trim()]));
    const liveInvite = new Map<string, number>();
    for (const d of inviteSnap.docs) {
      const exp = toMillis(d.data().expiresAt) ?? 0;
      if (!d.data().usedAt && exp > Date.now()) liveInvite.set(d.data().userId, Math.max(exp, liveInvite.get(d.data().userId) ?? 0));
    }
    const order = ['SCHOOL_OWNER', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ACCOUNTANT'];
    return snap.docs
      .filter((d) => d.data().role !== 'PARENT')
      .map((d) => {
        const u = d.data();
        return {
          userId: d.id,
          firstName: u.firstName ?? '',
          lastName: u.lastName ?? '',
          email: u.email,
          role: u.role,
          status: u.status as 'ACTIVE' | 'INVITED' | 'DISABLED',
          lastLogin: toMillis(u.lastLogin),
          teacherId: u.teacherId ?? null,
          teacherName: u.teacherId ? teachers.get(u.teacherId) ?? null : null,
          inviteExpiresAt: liveInvite.get(d.id) ?? null,
        };
      })
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }

  async invite(schoolId: string, user: JwtPayload, dto: InviteStaffDto) {
    this.checkCanGrant(user, dto.role);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.where('schoolId', '==', schoolId).get();
    const clash = existing.docs.find((d) => String(d.data().email ?? '').toLowerCase() === email);
    if (clash) {
      throw new BadRequestException(clash.data().role === 'PARENT' ? 'This email is already used by a parent account. Use a different email.' : 'Someone at your school already has an account with this email.');
    }
    if (dto.teacherId) {
      await getOwnedDoc(this.db.collection('teachers'), dto.teacherId, schoolId, 'Teacher not found');
      if (existing.docs.some((d) => d.data().teacherId === dto.teacherId)) throw new BadRequestException('This teacher already has an account.');
    }
    const now = new Date();
    const ref = await this.users.add({
      schoolId, email, password: null, firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), phone: null, avatar: null,
      role: dto.role, status: 'INVITED', teacherId: dto.teacherId ?? null, lastLogin: null,
      emailVerified: false, mfaEnabled: false, mfaSecret: null, permissions: [], invitedBy: user.sub, createdAt: now, updatedAt: now,
    });
    return { userId: ref.id, email, ...(await createInvite(this.db as any, schoolId, ref.id, user.sub)) };
  }

  async resend(schoolId: string, user: JwtPayload, userId: string) {
    const doc = await this.manageable(schoolId, user, userId);
    if (doc.data()!.status !== 'INVITED') throw new BadRequestException('This person has already set up their account.');
    return { userId, email: doc.data()!.email, ...(await createInvite(this.db as any, schoolId, userId, user.sub)) };
  }

  async changeRole(schoolId: string, user: JwtPayload, userId: string, dto: ChangeRoleDto) {
    this.checkCanGrant(user, dto.role);
    const doc = await this.manageable(schoolId, user, userId);
    await doc.ref.update({ role: dto.role, updatedAt: new Date() });
    // Signs them out so their next sign-in carries the new role.
    await revokeSessions(this.db as any, userId);
    return { userId, role: dto.role };
  }

  /** Links a teacher's sign-in to their Teachers record, which decides the classes they can work on. */
  async linkTeacher(schoolId: string, user: JwtPayload, userId: string, dto: LinkTeacherDto) {
    const doc = await this.manageable(schoolId, user, userId);
    if (doc.data()!.role !== 'TEACHER') throw new BadRequestException('Only teacher accounts are linked to a teacher record.');
    if (dto.teacherId) {
      await getOwnedDoc(this.db.collection('teachers'), dto.teacherId, schoolId, 'Teacher not found');
      const taken = await this.users.where('schoolId', '==', schoolId).where('teacherId', '==', dto.teacherId).get();
      if (taken.docs.some((d) => d.id !== userId)) throw new BadRequestException('Another account is already linked to this teacher.');
    }
    await doc.ref.update({ teacherId: dto.teacherId ?? null, updatedAt: new Date() });
    return { userId, teacherId: dto.teacherId ?? null };
  }

  async setEnabled(schoolId: string, user: JwtPayload, userId: string, enabled: boolean) {
    const doc = await this.manageable(schoolId, user, userId);
    const u = doc.data()!;
    const status = enabled ? (u.password ? 'ACTIVE' : 'INVITED') : 'DISABLED';
    await doc.ref.update({ status, updatedAt: new Date() });
    if (!enabled) await revokeSessions(this.db as any, userId);
    return { userId, status };
  }
}
