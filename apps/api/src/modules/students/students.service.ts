import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentPhotoDto } from './dto/student-photo.dto';
import { countOf } from '../../common/aggregate';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const validDate = (y: number, m: number, d: number) => {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/**
 * Reads a date of birth the way Nigerian schools write it in Excel and returns YYYY-MM-DD.
 * Day comes first (14/03/2015), as in Nigeria. Also accepts 2015-03-14, "14 March 2015",
 * "14-Mar-2015" and Excel's own date numbers. Returns null if it can't be read.
 */
export function readDateOfBirth(raw: string): string | null {
  const v = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(v);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validDate(y, +m[2], +m[1]);
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([a-z]+)\.?[\s\-/.,]+(\d{4})$/i.exec(v);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return month >= 0 ? validDate(+m[3], month + 1, +m[1]) : null;
  }
  m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(v);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return month >= 0 ? validDate(+m[3], month + 1, +m[2]) : null;
  }
  // Excel stores dates as days since 30 Dec 1899; 1900–2100 is roughly 1 to 73,000.
  if (/^\d{4,5}$/.test(v) && +v > 365 && +v < 73100) {
    const d = new Date(Date.UTC(1899, 11, 30) + +v * 86_400_000);
    return validDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

/** "Male", "M", "boy" → MALE; "Female", "F", "girl" → FEMALE. Returns null if it can't be read. */
export function readGender(raw: string): 'MALE' | 'FEMALE' | 'OTHER' | null {
  const v = raw.trim().toLowerCase();
  if (['m', 'male', 'boy', 'b'].includes(v)) return 'MALE';
  if (['f', 'female', 'girl', 'g'].includes(v)) return 'FEMALE';
  if (v === 'other') return 'OTHER';
  return null;
}

/** A student's ID card code stays on the server: it is only ever printed onto the card. */
const withoutCard = (id: string, data: FirebaseFirestore.DocumentData) => {
  const { cardCode: _code, cardIssuedAt: _issued, ...rest } = data;
  return { id, ...rest };
};

@Injectable()
export class StudentsService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('students');
  }

  async create(schoolId: string, dto: CreateStudentDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto, status: 'ACTIVE' };
  }

  async findAll(schoolId: string, search?: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    let results = snapshot.docs.map((doc) => withoutCard(doc.id, doc.data()));
    results.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
      return bTime - aTime;
    });

    if (search) {
      const s = search.toLowerCase();
      results = results.filter(
        (r: any) =>
          r.firstName?.toLowerCase().includes(s) ||
          r.lastName?.toLowerCase().includes(s) ||
          r.admissionNumber?.toLowerCase().includes(s),
      );
    }
    return results;
  }

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    return withoutCard(doc.id, doc.data()!);
  }

  async update(schoolId: string, id: string, dto: UpdateStudentDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { ...withoutCard(id, doc.data()!), ...dto };
  }

  /**
   * A student's photo. The small thumbnail rides on the student record so lists show faces
   * without extra reads; the full photo has its own document, read only by the profile and ID cards.
   */
  async setPhoto(schoolId: string, id: string, dto: StudentPhotoDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    const now = new Date();
    await this.photos.doc(id).set({ schoolId, photo: dto.photo, updatedAt: now });
    await doc.ref.update({ photoThumb: dto.thumb, photoAt: now, updatedAt: now });
    return { photo: dto.photo, photoThumb: dto.thumb };
  }

  async removePhoto(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    await this.photos.doc(id).delete();
    await doc.ref.update({ photoThumb: null, photoAt: null, updatedAt: new Date() });
    return { photo: null, photoThumb: null };
  }

  private get photos() {
    return this.firebase.firestore.collection('studentPhotos');
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Student not found');
    await doc.ref.update({ status: 'INACTIVE', updatedAt: new Date() });
    return { message: 'Student deactivated' };
  }

  /**
   * Resolves an imported class to this school's class ID. Accepts a class name
   * ("JSS 1A", matched ignoring case, spaces, hyphens and dots) or one of the school's class IDs.
   * When several classes match loosely, a class spelled exactly as written wins.
   */
  private async classResolver(schoolId: string) {
    const snap = await this.firebase.firestore.collection('classes').where('schoolId', '==', schoolId).get();
    // "JSS 1A", "JSS1A", "jss-1a" and "J.S.S 1A" are the same class: ignore case, spaces, hyphens and dots.
    const loose = (v: string) => v.toLowerCase().replace(/[\s\-_.]+/g, '');
    const exact = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
    const ids = new Set<string>();
    const byName = new Map<string, { id: string; name: string }[]>();
    for (const doc of snap.docs) {
      ids.add(doc.id);
      const { name, status } = doc.data();
      if (!name || status === 'INACTIVE') continue;
      byName.set(loose(name), [...(byName.get(loose(name)) ?? []), { id: doc.id, name }]);
    }
    return (value: string): { classId: string } | { error: string } => {
      const wanted = value.trim();
      const matches = byName.get(loose(wanted)) ?? [];
      if (matches.length === 1) return { classId: matches[0].id };
      if (matches.length > 1) {
        const spelledExactly = matches.filter((m) => exact(m.name) === exact(wanted));
        if (spelledExactly.length === 1) return { classId: spelledExactly[0].id };
        const names = [...new Set(matches.map((m) => `"${m.name}"`))];
        return {
          error:
            names.length === 1
              ? `${matches.length} active classes are named ${names[0]}. Delete the extra one on the Classes page, then import again.`
              : `More than one class matches "${wanted}": ${names.join(' and ')}. Delete or rename the extra one on the Classes page, then import again.`,
        };
      }
      if (ids.has(wanted)) return { classId: wanted };
      return { error: `Class "${wanted}" not found. Create it on the Classes page or check the spelling.` };
    };
  }

  async bulkCreate(schoolId: string, records: (Partial<CreateStudentDto> & { className?: string })[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: any[] = [];
    const resolveClass = await this.classResolver(schoolId);

    // Skip students who are already in the school (or appear twice in the file), so a file can be re-imported safely.
    const admissionKey = (v: string) => v.toLowerCase().replace(/\s+/g, '');
    const existing = new Map<string, string>();
    const studentsSnap = await this.col.where('schoolId', '==', schoolId).get();
    for (const doc of studentsSnap.docs) {
      const d = doc.data();
      if (d.admissionNumber) existing.set(admissionKey(String(d.admissionNumber)), `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim());
    }
    const seenInFile = new Map<string, number>();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.firstName || !r.lastName || !r.admissionNumber) {
        errors.push({ row: i + 1, message: 'Missing required fields: firstName, lastName, admissionNumber' });
        continue;
      }
      const key = admissionKey(String(r.admissionNumber));
      if (existing.has(key)) {
        errors.push({ row: i + 1, message: `Admission number ${r.admissionNumber} already belongs to ${existing.get(key) || 'a student'}, so this row was skipped.` });
        continue;
      }
      if (seenInFile.has(key)) {
        errors.push({ row: i + 1, message: `Admission number ${r.admissionNumber} is also on row ${seenInFile.get(key)} of this file, so this row was skipped.` });
        continue;
      }
      const rawDob = (r.dateOfBirth ?? '').toString().trim();
      const dateOfBirth = rawDob ? readDateOfBirth(rawDob) : '';
      if (dateOfBirth === null) {
        errors.push({ row: i + 1, message: `Date of birth "${rawDob}" wasn't understood. Write it day first, like 14/03/2015.` });
        continue;
      }
      const rawGender = (r.gender ?? '').toString().trim();
      const gender = rawGender ? readGender(rawGender) : '';
      if (gender === null) {
        errors.push({ row: i + 1, message: `Gender "${rawGender}" wasn't understood. Write Male or Female.` });
        continue;
      }
      const rawAdmitted = (r.admissionDate ?? '').toString().trim();
      const admissionDate = rawAdmitted ? readDateOfBirth(rawAdmitted) : null;
      if (rawAdmitted && !admissionDate) {
        errors.push({ row: i + 1, message: `Admission date "${rawAdmitted}" wasn't understood. Write it day first, like 14/09/2026.` });
        continue;
      }
      let classId: string | null = null;
      const wantedClass = (r.className || r.classId || '').toString();
      if (wantedClass.trim()) {
        const resolved = resolveClass(wantedClass);
        if ('error' in resolved) {
          errors.push({ row: i + 1, message: resolved.error });
          continue;
        }
        classId = resolved.classId;
      }
      const ref = this.col.doc();
      batch.set(ref, {
        schoolId,
        firstName: r.firstName,
        lastName: r.lastName,
        dateOfBirth,
        gender,
        admissionNumber: r.admissionNumber,
        admissionDate,
        classId,
        section: r.section || null,
        parentEmail: r.parentEmail || null,
        parentPhone: r.parentPhone || null,
        address: r.address || null,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
      created.push({ id: ref.id, ...r, classId });
      seenInFile.set(key, i + 1);
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
