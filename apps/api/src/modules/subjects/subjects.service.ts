import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { countOf } from '../../common/aggregate';

/** "Basic Science", "basic-science" and "BasicScience" are the same subject name. */
const nameKey = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');
/** Codes compare without case or spaces: "mth 1" is "MTH1". */
const codeKey = (v: string) => v.toUpperCase().replace(/\s+/g, '');

type Taken = { names: Map<string, string>; codes: Map<string, string> };

@Injectable()
export class SubjectsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('subjects');
  }

  /** Names and codes already used by this school's active subjects. */
  private async taken(schoolId: string, exceptId?: string): Promise<Taken> {
    const snap = await this.col.where('schoolId', '==', schoolId).get();
    const names = new Map<string, string>();
    const codes = new Map<string, string>();
    for (const doc of snap.docs) {
      const d = doc.data();
      if (doc.id === exceptId || d.status === 'INACTIVE') continue;
      if (d.name) names.set(nameKey(d.name), d.name);
      if (d.code) codes.set(codeKey(d.code), d.name ?? d.code);
    }
    return { names, codes };
  }

  /** Returns why a name/code can't be used, or null if both are free. */
  private conflict(taken: Taken, name?: string, code?: string): string | null {
    if (name && taken.names.has(nameKey(name))) return `A subject named "${taken.names.get(nameKey(name))}" already exists.`;
    if (code && taken.codes.has(codeKey(code))) return `The code "${codeKey(code)}" is already used by ${taken.codes.get(codeKey(code))}.`;
    return null;
  }

  async create(schoolId: string, dto: CreateSubjectDto) {
    const name = dto.name.trim();
    const code = codeKey(dto.code);
    const problem = this.conflict(await this.taken(schoolId), name, code);
    if (problem) throw new BadRequestException(problem);
    const now = new Date();
    const docRef = await this.col.add({ schoolId, name, code, status: 'ACTIVE', createdAt: now, updatedAt: now });
    return { id: docRef.id, schoolId, name, code, status: 'ACTIVE' };
  }

  async findAll(schoolId: string, name?: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    results.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
      return bTime - aTime;
    });

    if (name) {
      const s = name.toLowerCase();
      results = results.filter(
        (r: any) =>
          r.name?.toLowerCase().includes(s) || r.code?.toLowerCase().includes(s),
      );
    }
    return results;
  }

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Subject not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(schoolId: string, id: string, dto: UpdateSubjectDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Subject not found');
    const current = doc.data()!;
    const changes: Record<string, any> = {};
    if (dto.name !== undefined) changes.name = dto.name.trim();
    if (dto.code !== undefined) changes.code = codeKey(dto.code);
    if (dto.status) changes.status = dto.status;

    // Check names/codes that change, and both when restoring an archived subject.
    const restoring = dto.status === 'ACTIVE' && current.status === 'INACTIVE';
    const name = changes.name ?? current.name;
    const code = changes.code ?? current.code;
    const nameChanged = changes.name !== undefined && nameKey(changes.name) !== nameKey(current.name ?? '');
    const codeChanged = changes.code !== undefined && changes.code !== codeKey(current.code ?? '');
    if (restoring || nameChanged || codeChanged) {
      const problem = this.conflict(
        await this.taken(schoolId, id),
        restoring || nameChanged ? name : undefined,
        restoring || codeChanged ? code : undefined,
      );
      if (problem) throw new BadRequestException(restoring ? `Can't restore: ${problem}` : problem);
    }

    await doc.ref.update({ ...changes, updatedAt: new Date() });
    return { id, ...current, ...changes };
  }

  /** Archives the subject; past exams and results that use it are unaffected. */
  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Subject not found');
    await doc.ref.update({ status: 'INACTIVE', updatedAt: new Date() });
    return { message: 'Subject archived' };
  }

  async bulkCreate(schoolId: string, records: any[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: any[] = [];

    const taken = await this.taken(schoolId);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name || !r.code) {
        errors.push({ row: i + 1, message: 'Missing required fields: name, code' });
        continue;
      }
      const name = String(r.name).trim();
      const code = codeKey(String(r.code));
      const problem = this.conflict(taken, name, code);
      if (problem) {
        errors.push({ row: i + 1, message: `${problem.replace(/\.$/, '')}, so this row was skipped.` });
        continue;
      }
      taken.names.set(nameKey(name), name);
      taken.codes.set(code, name);
      const ref = this.col.doc();
      batch.set(ref, { schoolId, name, code, status: 'ACTIVE', createdAt: now, updatedAt: now });
      created.push({ id: ref.id, name, code });
    }

    if (created.length > 0) await batch.commit();
    return { imported: created.length, errors };
  }

  async count(schoolId: string) {
    return countOf(this.col
      .where('schoolId', '==', schoolId)
      .where('status', '==', 'ACTIVE'));
  }
}
