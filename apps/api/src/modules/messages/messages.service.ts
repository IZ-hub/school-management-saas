import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { open, seal } from '../../common/secret-box';
import { schoolToday } from '../../common/school-date';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { FeesService } from '../fees/fees.service';
import { TermiiClient } from './termii.client';
import { Audience, ComposeDto } from './dto/messages.dto';

const MAX_RECIPIENTS = 2000;
const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

/** Nigerian numbers become 234XXXXXXXXXX; anything that doesn't look like a phone number is dropped. */
export function normalisePhone(raw?: string | null): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = `234${d.slice(1)}`;
  if (d.length === 10 && /^[789]/.test(d)) d = `234${d}`;
  return /^234[789]\d{9}$/.test(d) ? d : null;
}

/** SMS pages: one page is 160 characters; longer messages are split into 153-character parts. */
export const smsPages = (text: string) => (text.length <= 160 ? 1 : Math.ceil(text.length / 153));

/** Fills {parent}, {student}, {class}, {balance} and {school}. */
export function render(text: string, v: { parent: string; student: string; class: string; balance: string; school: string }) {
  return text.replace(/\{(parent|student|class|balance|school)\}/gi, (_, k: string) => v[k.toLowerCase() as keyof typeof v]);
}

interface Recipient {
  studentId: string;
  studentName: string;
  className: string;
  parentUserIds: string[];
  parentName: string;
  phone: string | null;
  balance: number | null;
}

@Injectable()
export class MessagesService {
  constructor(private readonly firebase: FirebaseService, private readonly termii: TermiiClient, private readonly fees: FeesService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private secrets(schoolId: string) {
    return this.db.collection('schoolSecrets').doc(schoolId);
  }

  // ----- SMS settings (the school's own Termii account) -----

  private async sms(schoolId: string): Promise<{ apiKey: string; senderId: string } | null> {
    const d = (await this.secrets(schoolId).get()).data();
    const apiKey = d?.termiiApiKey ? open(d.termiiApiKey) : null;
    return apiKey && d?.termiiSenderId ? { apiKey, senderId: d.termiiSenderId } : null;
  }

  async smsSettings(schoolId: string) {
    const d = (await this.secrets(schoolId).get()).data();
    const ok = !!d?.termiiApiKey && open(d.termiiApiKey) !== null;
    let balance: number | null = null;
    if (ok) balance = await this.termii.checkKey(open(d!.termiiApiKey)!).then((b) => b.balance).catch(() => null);
    return { enabled: ok, needsNewKey: !!d?.termiiApiKey && !ok, senderId: ok ? d!.termiiSenderId : null, keyHint: ok ? d!.termiiKeyHint : null, balance };
  }

  async saveSmsSettings(schoolId: string, userId: string, apiKey: string, senderId: string) {
    await this.termii.checkKey(apiKey);
    const ref = this.secrets(schoolId);
    const existing = (await ref.get()).data() ?? {};
    await ref.set({ ...existing, schoolId, termiiApiKey: seal(apiKey), termiiSenderId: senderId.trim(), termiiKeyHint: `…${apiKey.slice(-4)}`, updatedBy: userId, updatedAt: new Date() });
    return this.smsSettings(schoolId);
  }

  async removeSmsSettings(schoolId: string) {
    const ref = this.secrets(schoolId);
    const d = (await ref.get()).data();
    if (d) {
      const { termiiApiKey: _k, termiiSenderId: _s, termiiKeyHint: _h, ...rest } = d;
      await ref.set(rest);
    }
    return this.smsSettings(schoolId);
  }

  // ----- Audiences -----

  private async recipients(schoolId: string, user: JwtPayload, audience: Audience, classIds: string[] = []): Promise<Recipient[]> {
    if (user.role === 'ACCOUNTANT' && audience !== 'OWING') throw new ForbiddenException('Accountants can send fee reminders only.');
    if (audience === 'CLASSES' && classIds.length === 0) throw new BadRequestException('Choose at least one class.');
    const [studentSnap, classSnap, parentSnap] = await Promise.all([
      this.db.collection('students').where('schoolId', '==', schoolId).get(),
      this.db.collection('classes').where('schoolId', '==', schoolId).get(),
      this.db.collection('users').where('schoolId', '==', schoolId).where('role', '==', 'PARENT').get(),
    ]);
    const classes = new Map(classSnap.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => [d.id, String(d.data().name ?? '')]));
    if (classIds.some((c) => !classes.has(c))) throw new BadRequestException("One of the chosen classes wasn't found.");
    let students = studentSnap.docs.filter((d) => d.data().status !== 'INACTIVE' && classes.has(d.data().classId));
    if (classIds.length) students = students.filter((d) => classIds.includes(d.data().classId));

    let balances = new Map<string, number>();
    if (audience === 'OWING') {
      const o = await this.fees.overview(schoolId);
      balances = new Map(o.students.filter((s) => s.balance > 0).map((s) => [s.id, s.balance]));
      students = students.filter((d) => balances.has(d.id));
    }
    if (audience === 'ABSENT_TODAY') {
      const marks = await this.db.collection('attendance').where('schoolId', '==', schoolId).where('date', '==', schoolToday()).get();
      const absent = new Set(marks.docs.filter((m) => m.data().status === 'ABSENT').map((m) => m.data().studentId));
      students = students.filter((d) => absent.has(d.id));
    }

    const parentsOf = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const p of parentSnap.docs) {
      if (p.data().status === 'DISABLED') continue;
      for (const c of p.data().childIds ?? []) parentsOf.set(c, [...(parentsOf.get(c) ?? []), p]);
    }
    return students
      .map((d) => {
        const s = d.data();
        const parents = parentsOf.get(d.id) ?? [];
        const phone = normalisePhone(parents.find((p) => normalisePhone(p.data().phone))?.data().phone) ?? normalisePhone(s.parentPhone);
        return {
          studentId: d.id,
          studentName: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
          className: classes.get(s.classId) ?? '',
          parentUserIds: parents.map((p) => p.id),
          parentName: parents[0]?.data().firstName ?? s.parentName?.split(' ')[0] ?? 'Parent',
          phone,
          balance: balances.get(d.id) ?? null,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.studentName.localeCompare(b.studentName));
  }

  private vars(r: Recipient, school: string) {
    return { parent: r.parentName, student: r.studentName.split(' ')[0], class: r.className, balance: r.balance !== null ? naira(r.balance) : '', school };
  }

  private async schoolName(schoolId: string) {
    const d = await this.db.collection('schools').doc(schoolId).get();
    return d.exists ? String(d.data()!.name ?? '') : '';
  }

  async preview(schoolId: string, user: JwtPayload, dto: ComposeDto) {
    const list = await this.recipients(schoolId, user, dto.audience, dto.classIds);
    const school = await this.schoolName(schoolId);
    const sample = list[0] ? render(dto.text, this.vars(list[0], school)) : render(dto.text, { parent: 'Ngozi', student: 'Chioma', class: 'JSS1', balance: '₦50,000', school });
    const withPhone = list.filter((r) => r.phone).length;
    return {
      students: list.length,
      onParentPage: list.filter((r) => r.parentUserIds.length).length,
      withPhone,
      withoutPhone: list.length - withPhone,
      pages: smsPages(sample),
      smsTotal: withPhone * smsPages(sample),
      smsAvailable: (await this.sms(schoolId)) !== null,
      sample,
      tooMany: list.length > MAX_RECIPIENTS,
    };
  }

  /** Saves the message (it shows on each parent's page) and, if asked, texts each family. */
  async send(schoolId: string, user: JwtPayload, dto: ComposeDto) {
    const list = await this.recipients(schoolId, user, dto.audience, dto.classIds);
    if (list.length === 0) throw new BadRequestException('Nobody matches. Choose a different group.');
    if (list.length > MAX_RECIPIENTS) throw new BadRequestException(`You can message up to ${MAX_RECIPIENTS} families at once. Choose fewer classes.`);
    const sms = dto.sms ? await this.sms(schoolId) : null;
    if (dto.sms && !sms) throw new BadRequestException('Set up SMS in School settings first, or send to parent pages only.');

    const [school, me] = await Promise.all([this.schoolName(schoolId), this.db.collection('users').doc(user.sub).get()]);
    const byName = me.exists ? `${me.data()!.firstName ?? ''} ${me.data()!.lastName ?? ''}`.trim() : user.email;
    const now = new Date();
    const msgRef = this.db.collection('messages').doc();
    const deliveries = this.db.collection('messageDeliveries');

    let sent = 0, failed = 0, skipped = 0;
    const results: { r: Recipient; text: string; sms: { status: string; error?: string; messageId?: string | null } }[] = [];
    // Send a few at a time so a large class doesn't take minutes, without flooding the provider.
    const queue = [...list];
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const text = render(dto.text, this.vars(r, school));
        let status: { status: string; error?: string; messageId?: string | null } = { status: 'NOT_REQUESTED' };
        if (sms) {
          if (!r.phone) { status = { status: 'NO_PHONE' }; skipped++; }
          else {
            try { status = { status: 'SENT', messageId: (await this.termii.send(sms.apiKey, sms.senderId, r.phone, text)).messageId }; sent++; }
            catch (err) { status = { status: 'FAILED', error: (err as Error).message.slice(0, 200) }; failed++; }
          }
        }
        results.push({ r, text, sms: status });
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));

    for (let i = 0; i < results.length; i += 400) {
      const batch = this.db.batch();
      for (const { r, text, sms: s } of results.slice(i, i + 400)) {
        batch.set(deliveries.doc(), {
          schoolId, messageId: msgRef.id, studentId: r.studentId, studentName: r.studentName, className: r.className,
          parentUserIds: r.parentUserIds, phone: r.phone, text, sms: s, createdAt: now,
        });
      }
      await batch.commit();
    }
    const counts = { students: list.length, onParentPage: list.filter((r) => r.parentUserIds.length).length, sms: { sent, failed, skipped } };
    await msgRef.set({ schoolId, text: dto.text, audience: dto.audience, classIds: dto.classIds ?? [], sms: !!sms, by: user.sub, byName, createdAt: now, counts });
    return { id: msgRef.id, counts };
  }

  async history(schoolId: string) {
    const snap = await this.db.collection('messages').where('schoolId', '==', schoolId).get();
    return snap.docs
      .map((d) => ({ id: d.id, text: d.data().text, audience: d.data().audience, classIds: d.data().classIds, sms: d.data().sms, byName: d.data().byName, createdAt: d.data().createdAt, counts: d.data().counts }))
      .sort((a, b) => (b.createdAt?.valueOf?.() ?? 0) - (a.createdAt?.valueOf?.() ?? 0))
      .slice(0, 100);
  }

  /** Who didn't get an SMS for one message, so the school can follow up. */
  async problems(schoolId: string, messageId: string) {
    const snap = await this.db.collection('messageDeliveries').where('schoolId', '==', schoolId).where('messageId', '==', messageId).get();
    return snap.docs
      .map((d) => d.data())
      .filter((d) => d.sms?.status === 'FAILED' || d.sms?.status === 'NO_PHONE')
      .map((d) => ({ studentName: d.studentName, className: d.className, phone: d.phone, status: d.sms.status, error: d.sms.error ?? null }));
  }

  /** A parent's inbox: messages sent about any of their children, newest first. */
  async inbox(user: JwtPayload) {
    const me = await this.db.collection('users').doc(user.sub).get();
    if (!me.exists || me.data()!.role !== 'PARENT' || me.data()!.status !== 'ACTIVE') throw new ForbiddenException('Your account is not active.');
    const childIds: string[] = me.data()!.childIds ?? [];
    const lists = await Promise.all(childIds.map((id) => this.db.collection('messageDeliveries').where('schoolId', '==', user.schoolId).where('studentId', '==', id).get()));
    return lists
      .flatMap((s) => s.docs.map((d) => ({ id: d.id, studentId: d.data().studentId, studentName: d.data().studentName, text: d.data().text, createdAt: d.data().createdAt })))
      .sort((a, b) => (b.createdAt?.valueOf?.() ?? 0) - (a.createdAt?.valueOf?.() ?? 0))
      .slice(0, 50);
  }
}
