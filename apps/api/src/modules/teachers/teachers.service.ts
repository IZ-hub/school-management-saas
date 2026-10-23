import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { getOwnedDoc } from '../../common/tenant';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { countOf } from '../../common/aggregate';
import { readDateOfBirth, readGender } from '../students/students.service';

/** Excel drops a phone number's first 0 (8031234567); put it back for Nigerian mobile numbers. */
const readPhone = (raw: string) => {
  const v = raw.trim();
  return /^[789][01]\d{8}$/.test(v) ? `0${v}` : v;
};

/** "₦150,000", "150000.00" or "150 000" → 150000; null if it isn't an amount. */
const readSalary = (raw: string) => {
  const n = Number(raw.replace(/[₦,\s]|NGN/gi, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

@Injectable()
export class TeachersService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('teachers');
  }

  async create(schoolId: string, dto: CreateTeacherDto) {
    const now = new Date();
    const docRef = await this.col.add({
      schoolId,
      ...dto,
      subjectIds: [],
      status: 'ACTIVE',
      documents: [],
      createdAt: now,
      updatedAt: now,
    });
    return { id: docRef.id, schoolId, ...dto, status: 'ACTIVE' };
  }

  async findAll(schoolId: string, search?: string) {
    const snapshot = await this.col.where('schoolId', '==', schoolId).get();
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
          r.employeeNumber?.toLowerCase().includes(s) ||
          r.email?.toLowerCase().includes(s),
      );
    }
    return results;
  }

  async findOne(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Teacher not found');
    return { id: doc.id, ...doc.data() };
  }

  async update(schoolId: string, id: string, dto: UpdateTeacherDto) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Teacher not found');
    await doc.ref.update({ ...dto, updatedAt: new Date() });
    return { id, ...doc.data(), ...dto };
  }

  async remove(schoolId: string, id: string) {
    const doc = await getOwnedDoc(this.col, id, schoolId, 'Teacher not found');
    await doc.ref.update({ status: 'INACTIVE', updatedAt: new Date() });
    return { message: 'Teacher deactivated' };
  }

  /**
   * Imports teachers from a spreadsheet. Reads dates day first (14/05/1988), genders as M/F/Male/Female,
   * and skips anyone whose employee number is already in the school or earlier in the file, so the same
   * file can be uploaded again safely.
   */
  async bulkCreate(schoolId: string, records: any[]) {
    const now = new Date();
    const batch = this.firebase.firestore.batch();
    const created: any[] = [];
    const errors: { row: number; message: string }[] = [];

    const numberKey = (v: string) => v.toLowerCase().replace(/\s+/g, '');
    const existing = new Map<string, string>();
    for (const doc of (await this.col.where('schoolId', '==', schoolId).get()).docs) {
      const d = doc.data();
      if (d.employeeNumber) existing.set(numberKey(String(d.employeeNumber)), `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim());
    }
    const seenInFile = new Map<string, number>();
    const text = (v: unknown) => (v ?? '').toString().trim();

    for (let i = 0; i < records.length; i++) {
      const r = records[i] ?? {};
      const row = i + 1;
      const missing = [['firstName', 'First Name'], ['lastName', 'Last Name'], ['employeeNumber', 'Employee Number'], ['email', 'Email'], ['phone', 'Phone']]
        .filter(([k]) => !text(r[k])).map(([, label]) => label);
      if (missing.length) {
        errors.push({ row, message: `Missing ${missing.join(', ')}.` });
        continue;
      }
      const employeeNumber = text(r.employeeNumber);
      const key = numberKey(employeeNumber);
      if (existing.has(key)) {
        errors.push({ row, message: `Employee number ${employeeNumber} already belongs to ${existing.get(key) || 'a teacher'}, so this row was skipped.` });
        continue;
      }
      if (seenInFile.has(key)) {
        errors.push({ row, message: `Employee number ${employeeNumber} is also on row ${seenInFile.get(key)} of this file, so this row was skipped.` });
        continue;
      }
      const email = text(r.email);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.push({ row, message: `Email "${email}" doesn't look like an email address.` });
        continue;
      }
      const dates: Record<string, string | null> = {};
      let bad = '';
      for (const [k, label, example] of [['dateOfBirth', 'Date of birth', '14/05/1988'], ['joiningDate', 'Joining date', '09/09/2024']]) {
        const raw = text(r[k]);
        dates[k] = raw ? readDateOfBirth(raw) : null;
        if (raw && !dates[k]) { bad = `${label} "${raw}" wasn't understood. Write it day first, like ${example}.`; break; }
      }
      if (bad) { errors.push({ row, message: bad }); continue; }
      const rawGender = text(r.gender);
      const gender = rawGender ? readGender(rawGender) : '';
      if (gender === null) {
        errors.push({ row, message: `Gender "${rawGender}" wasn't understood. Write Male or Female.` });
        continue;
      }
      const rawSalary = text(r.salary);
      const salary = rawSalary ? readSalary(rawSalary) : null;
      if (rawSalary && salary === null) {
        errors.push({ row, message: `Salary "${rawSalary}" isn't an amount. Write it like 150000.` });
        continue;
      }

      const ref = this.col.doc();
      const teacher = {
        schoolId,
        firstName: text(r.firstName),
        lastName: text(r.lastName),
        dateOfBirth: dates.dateOfBirth ?? '',
        gender,
        employeeNumber,
        email,
        phone: readPhone(text(r.phone)),
        address: text(r.address) || null,
        qualification: text(r.qualification) || null,
        department: text(r.department) || null,
        joiningDate: dates.joiningDate,
        salary,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      batch.set(ref, teacher);
      created.push({ id: ref.id, ...teacher });
      seenInFile.set(key, row);
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
