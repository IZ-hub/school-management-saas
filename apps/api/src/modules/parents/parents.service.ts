import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { createInvite, revokeSessions } from '../../common/invites';
import { schoolToday } from '../../common/school-date';
import { TermCalendar } from '../../common/term-calendar';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { FeesService } from '../fees/fees.service';
import { ReportCardsService } from '../report-cards/report-cards.service';
import { InviteParentDto } from './dto/invite-parent.dto';

const toMillis = (v: any): number => v?.toMillis?.() ?? v?.getTime?.() ?? new Date(v).getTime();

@Injectable()
export class ParentsService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly fees: FeesService,
    private readonly reportCards: ReportCardsService,
  ) {}

  private get db() {
    return this.firebase.firestore;
  }

  private get users() {
    return this.db.collection('users');
  }

  private createInvite(schoolId: string, userId: string, createdBy: string) {
    return createInvite(this.db as any, schoolId, userId, createdBy);
  }

  /** Parents linked to a student, for the Students page. */
  async forStudent(schoolId: string, studentId: string) {
    await getOwnedDoc(this.db.collection('students'), studentId, schoolId, 'Student not found');
    const snap = await this.users.where('schoolId', '==', schoolId).where('role', '==', 'PARENT').get();
    const parents = snap.docs.filter((d) => (d.data().childIds ?? []).includes(studentId));
    const invites = await Promise.all(parents.map((p) => this.db.collection('invites').where('userId', '==', p.id).get()));
    return parents.map((p, i) => {
      const live = invites[i].docs.map((d) => d.data()).filter((d) => !d.usedAt && toMillis(d.expiresAt) > Date.now());
      return {
        userId: p.id,
        firstName: p.data().firstName,
        lastName: p.data().lastName,
        email: p.data().email,
        phone: p.data().phone ?? null,
        status: p.data().status as 'ACTIVE' | 'INVITED' | 'DISABLED',
        inviteExpiresAt: live.length ? live.map((d) => toMillis(d.expiresAt)).sort().pop() : null,
        children: (p.data().childIds ?? []).length,
      };
    });
  }

  /**
   * Gives a parent access to a student. A new parent gets an account and a setup link;
   * an existing parent just gets the child added (and a fresh link if they never finished setup).
   */
  async invite(schoolId: string, user: JwtPayload, dto: InviteParentDto) {
    const student = await getOwnedDoc(this.db.collection('students'), dto.studentId, schoolId, 'Student not found');
    if (student.data()!.status === 'INACTIVE') throw new BadRequestException("This student has left the school, so parents can't be added.");
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.where('email', '==', email).where('schoolId', '==', schoolId).limit(1).get();
    const now = new Date();
    const name = { firstName: dto.firstName.trim(), lastName: dto.lastName.trim() };

    if (!existing.empty) {
      const doc = existing.docs[0];
      const u = doc.data();
      if (u.role !== 'PARENT') throw new BadRequestException('This email belongs to a staff account at your school. Use a different email for the parent.');
      const childIds: string[] = [...new Set([...(u.childIds ?? []), dto.studentId])];
      const status = u.status === 'DISABLED' ? (u.password ? 'ACTIVE' : 'INVITED') : u.status;
      await doc.ref.update({ childIds, status, ...(dto.phone ? { phone: dto.phone.trim() } : {}), updatedAt: now });
      if (status === 'ACTIVE') return { status: 'LINKED' as const, userId: doc.id, email };
      const invite = await this.createInvite(schoolId, doc.id, user.sub);
      return { status: 'INVITED' as const, userId: doc.id, email, ...invite };
    }

    const ref = await this.users.add({
      schoolId, email, password: null, ...name, phone: dto.phone?.trim() || null, avatar: null,
      role: 'PARENT', status: 'INVITED', childIds: [dto.studentId], lastLogin: null,
      emailVerified: false, mfaEnabled: false, mfaSecret: null, permissions: [], invitedBy: user.sub, createdAt: now, updatedAt: now,
    });
    const invite = await this.createInvite(schoolId, ref.id, user.sub);
    return { status: 'INVITED' as const, userId: ref.id, email, ...invite };
  }

  /** A new setup link for a parent who hasn't finished setting up. */
  async resendInvite(schoolId: string, user: JwtPayload, userId: string) {
    const doc = await getOwnedDoc(this.users, userId, schoolId, 'Parent not found');
    if (doc.data()!.role !== 'PARENT') throw new NotFoundException('Parent not found');
    if (doc.data()!.status !== 'INVITED') throw new BadRequestException('This parent has already set up their account.');
    return { status: 'INVITED' as const, userId, email: doc.data()!.email, ...(await this.createInvite(schoolId, userId, user.sub)) };
  }

  /** Removes a parent's access to one child; with no children left the account is switched off. */
  async unlink(schoolId: string, userId: string, studentId: string) {
    const doc = await getOwnedDoc(this.users, userId, schoolId, 'Parent not found');
    if (doc.data()!.role !== 'PARENT') throw new NotFoundException('Parent not found');
    const childIds = (doc.data()!.childIds ?? []).filter((id: string) => id !== studentId);
    await doc.ref.update({ childIds, ...(childIds.length === 0 ? { status: 'DISABLED' } : {}), updatedAt: new Date() });
    if (childIds.length === 0) await revokeSessions(this.db as any, userId);
    return { childIds };
  }

  // ----- Parent portal -----

  /** The signed-in parent's children, re-checked against the database on every request. */
  private async myChildren(user: JwtPayload) {
    const me = await this.users.doc(user.sub).get();
    if (!me.exists || me.data()!.role !== 'PARENT' || me.data()!.status !== 'ACTIVE' || me.data()!.schoolId !== user.schoolId) {
      throw new ForbiddenException('Your account is not active.');
    }
    const ids: string[] = me.data()!.childIds ?? [];
    const docs = await Promise.all(ids.map((id) => this.db.collection('students').doc(id).get()));
    return docs.filter((d) => d.exists && d.data()!.schoolId === user.schoolId && d.data()!.status !== 'INACTIVE');
  }

  private async myChild(user: JwtPayload, studentId: string) {
    const child = (await this.myChildren(user)).find((d) => d.id === studentId);
    if (!child) throw new NotFoundException('Student not found');
    return child;
  }

  async children(user: JwtPayload) {
    const [kids, school, classSnap] = await Promise.all([
      this.myChildren(user),
      this.db.collection('schools').doc(user.schoolId).get(),
      this.db.collection('classes').where('schoolId', '==', user.schoolId).get(),
    ]);
    const classes = new Map(classSnap.docs.map((d) => [d.id, d.data().name]));
    return {
      schoolName: school.exists ? school.data()!.name : '',
      schoolLogo: school.exists ? school.data()!.logo ?? null : null,
      children: kids.map((d) => ({
        id: d.id, firstName: d.data()!.firstName, lastName: d.data()!.lastName, admissionNumber: d.data()!.admissionNumber ?? '',
        className: classes.get(d.data()!.classId) ?? null,
      })),
    };
  }

  /** One child at a glance: attendance this term, fees this term, and published report cards. */
  async overview(user: JwtPayload, studentId: string) {
    const child = await this.myChild(user, studentId);
    const calendar = await TermCalendar.load(this.db as any, user.schoolId);
    const ts = calendar.current();
    const { from, to } = calendar.range(ts.term, ts.session);
    const [marksSnap, statement, seriesSnap] = await Promise.all([
      this.db.collection('attendance').where('schoolId', '==', user.schoolId).where('studentId', '==', studentId).get(),
      this.fees.statement(user.schoolId, studentId, ts.term, ts.session),
      this.db.collection('examSeries').where('schoolId', '==', user.schoolId).get(),
    ]);
    const marks = marksSnap.docs.map((d) => d.data()).filter((m) => m.date >= from && m.date <= to && m.date <= schoolToday());
    const count = (s: string) => marks.filter((m) => m.status === s).length;
    const expected = count('PRESENT') + count('LATE') + count('ABSENT');
    const classId = child.data()!.classId;
    const reportCards = seriesSnap.docs
      .filter((d) => d.data().resultsPublished && (d.data().classIds ?? []).includes(classId))
      .map((d) => ({ seriesId: d.id, name: d.data().name, publishedAt: d.data().publishedAt ?? null, startDate: d.data().startDate }))
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    const { school: _school, ...fees } = statement;
    const secrets = await this.db.collection('schoolSecrets').doc(user.schoolId).get();
    return {
      ...ts,
      attendance: {
        from, to,
        present: count('PRESENT'), late: count('LATE'), absent: count('ABSENT'), excused: count('EXCUSED'),
        rate: expected ? Math.round(((count('PRESENT') + count('LATE')) / expected) * 100) : null,
        recent: marks.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((m) => ({ date: m.date, status: m.status })),
      },
      fees,
      onlinePayments: secrets.exists && !!secrets.data()!.paystackSecretKey,
      reportCards,
    };
  }

  /** A published report card for one of the parent's children. */
  async reportCard(user: JwtPayload, studentId: string, seriesId: string) {
    const child = await this.myChild(user, studentId);
    const series = await this.db.collection('examSeries').doc(seriesId).get();
    if (!series.exists || series.data()!.schoolId !== user.schoolId || !series.data()!.resultsPublished) throw new NotFoundException('Report card not found');
    const report = await this.reportCards.forClass(user.schoolId, seriesId, child.data()!.classId);
    const card = report.cards.find((c) => c.student.id === studentId);
    if (!card) throw new NotFoundException('Report card not found');
    // Only this child's card, plus the class-level figures printed on every card.
    const { cards: _cards, canRemark: _canRemark, ...rest } = report;
    return { ...rest, card };
  }

  async feeStatement(user: JwtPayload, studentId: string, term?: string, session?: string) {
    await this.myChild(user, studentId);
    return this.fees.statement(user.schoolId, studentId, term, session);
  }
}
