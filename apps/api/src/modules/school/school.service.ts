import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { isIsoDate, TERMS } from '../../common/school-date';
import { TermCalendar, TermDates } from '../../common/term-calendar';
import { SaveTermsDto, UpdateSchoolDto } from './dto/school.dto';

const TERM_NAME = { FIRST: 'First Term', SECOND: 'Second Term', THIRD: 'Third Term' } as const;

@Injectable()
export class SchoolService {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.firestore;
  }

  private async doc(schoolId: string) {
    const doc = await this.db.collection('schools').doc(schoolId).get();
    if (!doc.exists) throw new NotFoundException('School not found');
    return doc;
  }

  async get(schoolId: string) {
    const s = (await this.doc(schoolId)).data()!;
    const calendar = new TermCalendar(s.termDates ?? []);
    return {
      id: schoolId,
      name: s.name ?? '',
      address: s.address ?? '',
      city: s.city ?? '',
      state: s.state ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      motto: s.motto ?? '',
      principalName: s.principalName ?? '',
      logo: s.logo ?? null,
      termDates: ((s.termDates ?? []) as TermDates[]).sort((a, b) => a.start.localeCompare(b.start)),
      currentTerm: calendar.current(),
    };
  }

  async update(schoolId: string, dto: UpdateSchoolDto) {
    const doc = await this.doc(schoolId);
    const tidy = (v?: string) => (v === undefined ? undefined : v.trim().replace(/\s+/g, ' '));
    const changes: Record<string, any> = {};
    for (const k of ['name', 'address', 'city', 'state', 'phone', 'email', 'motto', 'principalName'] as const) {
      const v = tidy(dto[k]);
      if (v !== undefined) changes[k] = v;
    }
    if (changes.name === '') throw new BadRequestException('The school needs a name.');
    if (dto.logo !== undefined) changes.logo = dto.logo;
    await doc.ref.update({ ...changes, updatedAt: new Date() });
    return this.get(schoolId);
  }

  /** Sets a session's term dates. Terms must be in order, inside the session's years, and not overlap. */
  async saveTerms(schoolId: string, dto: SaveTermsDto) {
    const [y1, y2] = dto.session.split('/').map(Number);
    if (y2 !== y1 + 1) throw new BadRequestException('Session must be two consecutive years, like 2026/2027.');
    const seen = new Set<string>();
    for (const t of dto.terms) {
      if (seen.has(t.term)) throw new BadRequestException(`${TERM_NAME[t.term]} is listed twice.`);
      seen.add(t.term);
      if (!isIsoDate(t.start) || !isIsoDate(t.end)) throw new BadRequestException(`Use dates like 2026-09-14 for ${TERM_NAME[t.term]}.`);
      if (t.end < t.start) throw new BadRequestException(`${TERM_NAME[t.term]} ends before it starts.`);
      if (t.start < `${y1}-07-01` || t.end > `${y2}-09-30`) throw new BadRequestException(`${TERM_NAME[t.term]} should fall within the ${dto.session} session.`);
    }
    const sorted = [...dto.terms].sort((a, b) => TERMS.indexOf(a.term) - TERMS.indexOf(b.term));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start <= sorted[i - 1].end) throw new BadRequestException(`${TERM_NAME[sorted[i].term]} must start after ${TERM_NAME[sorted[i - 1].term]} ends.`);
    }
    const doc = await this.doc(schoolId);
    const others = ((doc.data()!.termDates ?? []) as TermDates[]).filter((t) => t.session !== dto.session);
    const termDates = [...others, ...sorted.map((t) => ({ session: dto.session, term: t.term, start: t.start, end: t.end }))];
    await doc.ref.update({ termDates, updatedAt: new Date() });
    return this.get(schoolId);
  }
}
